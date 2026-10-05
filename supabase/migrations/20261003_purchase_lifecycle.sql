alter table public.orders
  add column if not exists payment_secured_at timestamptz;

alter table public.escrow_transactions
  add column if not exists buyer_confirmed_at timestamptz;

create or replace function public.simulate_marketplace_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_escrow public.escrow_transactions%rowtype;
  v_transaction_id uuid;
begin
  if v_buyer_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or v_order.buyer_id <> v_buyer_id then
    raise exception 'This purchase is not available to your account' using errcode = '42501';
  end if;
  if v_order.status not in ('pending', 'payment_pending') then
    raise exception 'This purchase is not awaiting simulated payment' using errcode = '55000';
  end if;

  select * into v_escrow
  from public.escrow_transactions
  where order_id = v_order.id
  for update;

  if not found or v_escrow.buyer_id <> v_buyer_id or v_escrow.status <> 'pending' then
    raise exception 'This escrow is not awaiting simulated payment' using errcode = '55000';
  end if;

  select t.id into v_transaction_id
  from public.transactions t
    where t.order_id = v_order.id
      and t.user_id = v_buyer_id
      and t.type = 'purchase'
      and t.status = 'pending'
  for update;

  if not found then
    raise exception 'The pending purchase transaction was not found' using errcode = '55000';
  end if;

  update public.orders
  set status = 'paid', payment_secured_at = now()
  where id = v_order.id;

  update public.escrow_transactions
  set status = 'held', funded_at = now()
  where id = v_escrow.id;

  update public.transactions
  set status = 'completed',
      metadata = metadata || jsonb_build_object(
        'payment_status', 'simulated_secured',
        'payment_secured_at', now()
      )
  where order_id = v_order.id
    and user_id = v_buyer_id
    and type = 'purchase';
end;
$$;

create or replace function public.mark_marketplace_gift_card_delivered(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_seller_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_escrow public.escrow_transactions%rowtype;
  v_delivery_id uuid;
begin
  if v_seller_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select o.* into v_order
  from public.orders o
  join public.listings l on l.id = o.listing_id
  where o.id = p_order_id and l.seller_id = v_seller_id
  for update of o;

  if not found then
    raise exception 'This purchase is not available to your account' using errcode = '42501';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'Payment must be secured before delivery' using errcode = '55000';
  end if;

  select * into v_escrow
  from public.escrow_transactions
  where order_id = v_order.id
  for update;

  if not found or v_escrow.seller_id <> v_seller_id or v_escrow.status <> 'held' then
    raise exception 'This escrow is not ready for delivery' using errcode = '55000';
  end if;

  select id into v_delivery_id
  from public.deliveries
  where order_id = v_order.id
  order by created_at
  limit 1
  for update;

  if v_delivery_id is null then
    insert into public.deliveries (order_id, buyer_id, delivery_type, status, delivered_at)
    values (v_order.id, v_order.buyer_id, 'in_app', 'delivered', now())
    returning id into v_delivery_id;
  else
    update public.deliveries
    set status = 'delivered', delivered_at = coalesce(delivered_at, now())
    where id = v_delivery_id
      and buyer_id = v_order.buyer_id
      and status in ('pending', 'processing');

    if not found then
      raise exception 'This delivery cannot be marked delivered again' using errcode = '55000';
    end if;
  end if;

  update public.orders set status = 'delivered' where id = v_order.id;
  update public.escrow_transactions set status = 'release_pending' where id = v_escrow.id;
end;
$$;

create or replace function public.confirm_marketplace_gift_card_received(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_escrow public.escrow_transactions%rowtype;
  v_payout public.payouts%rowtype;
  v_has_payout boolean;
  v_payout_transaction_id uuid;
  v_now timestamptz := now();
  v_provider_reference text;
  v_brand text;
begin
  if v_buyer_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or v_order.buyer_id <> v_buyer_id then
    raise exception 'This purchase is not available to your account' using errcode = '42501';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'This purchase is not awaiting buyer confirmation' using errcode = '55000';
  end if;

  select * into v_escrow
  from public.escrow_transactions
  where order_id = v_order.id
  for update;

  if not found or v_escrow.buyer_id <> v_buyer_id or v_escrow.status <> 'release_pending' then
    raise exception 'This escrow is not awaiting buyer confirmation' using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.deliveries d
    where d.order_id = v_order.id
      and d.buyer_id = v_buyer_id
      and d.status = 'delivered'
  ) then
    raise exception 'The gift card has not been delivered' using errcode = '55000';
  end if;

  update public.orders set status = 'completed' where id = v_order.id;
  update public.escrow_transactions
  set status = 'released', buyer_confirmed_at = v_now, released_at = v_now
  where id = v_escrow.id;

  v_provider_reference := 'SIMULATED-' || v_order.id::text;
  select t.metadata->>'brand' into v_brand
  from public.transactions t
  where t.order_id = v_order.id
    and t.user_id = v_buyer_id
    and t.type = 'purchase';

  select * into v_payout
  from public.payouts
  where order_id = v_order.id
  for update;
  v_has_payout := found;

  if v_has_payout then
    if v_payout.seller_id <> v_escrow.seller_id
      or v_payout.amount <> v_order.amount
      or v_payout.currency <> v_order.currency then
      raise exception 'The existing payout does not match this purchase' using errcode = '55000';
    end if;
    update public.payouts
    set fee_amount = 0, net_amount = v_order.amount, status = 'completed',
        provider = 'simulated', provider_reference = v_provider_reference,
        processed_at = v_now
    where id = v_payout.id;
  else
    insert into public.payouts (
      seller_id, order_id, amount, currency, fee_amount, net_amount,
      status, provider, provider_reference, processed_at
    )
    values (
      v_escrow.seller_id, v_order.id, v_order.amount, v_order.currency,
      0, v_order.amount, 'completed', 'simulated', v_provider_reference, v_now
    );
  end if;

  select id into v_payout_transaction_id
  from public.transactions
  where order_id = v_order.id
    and user_id = v_escrow.seller_id
    and type = 'payout'
  for update;

  if found then
    update public.transactions
    set amount = v_order.amount, currency = v_order.currency, status = 'completed',
        provider = 'simulated', provider_reference = v_provider_reference,
        metadata = jsonb_build_object(
          'simulated', true,
          'seller_id', v_escrow.seller_id,
          'brand', v_brand,
          'payout_status', 'completed',
          'processed_at', v_now,
          'description', 'Seller payout simulated; no funds were transferred.'
        )
    where id = v_payout_transaction_id;
  else
    insert into public.transactions (user_id, order_id, type, amount, currency, status, provider, provider_reference, metadata)
    values (
      v_escrow.seller_id, v_order.id, 'payout', v_order.amount, v_order.currency,
      'completed', 'simulated', v_provider_reference,
      jsonb_build_object(
        'simulated', true,
        'seller_id', v_escrow.seller_id,
        'brand', v_brand,
        'payout_status', 'completed',
        'processed_at', v_now,
        'description', 'Seller payout simulated; no funds were transferred.'
      )
    );
  end if;
end;
$$;

alter function public.simulate_marketplace_payment(uuid) owner to postgres;
alter function public.mark_marketplace_gift_card_delivered(uuid) owner to postgres;
alter function public.confirm_marketplace_gift_card_received(uuid) owner to postgres;

revoke all on function public.simulate_marketplace_payment(uuid) from public, anon, authenticated;
revoke all on function public.mark_marketplace_gift_card_delivered(uuid) from public, anon, authenticated;
revoke all on function public.confirm_marketplace_gift_card_received(uuid) from public, anon, authenticated;

grant execute on function public.simulate_marketplace_payment(uuid) to authenticated;
grant execute on function public.mark_marketplace_gift_card_delivered(uuid) to authenticated;
grant execute on function public.confirm_marketplace_gift_card_received(uuid) to authenticated;
