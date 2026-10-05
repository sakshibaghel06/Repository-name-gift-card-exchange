create unique index if not exists wallet_transactions_marketplace_sale_credit_uq
on public.wallet_transactions (reference_type, reference_id)
where type = 'credit' and reference_type = 'order';

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
  v_wallet_id uuid;
  v_recovery boolean := false;
  v_credit_exists boolean;
  v_now timestamptz := now();
  v_wallet_reference text;
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

  select * into v_escrow
  from public.escrow_transactions
  where order_id = v_order.id
  for update;

  if not found or v_escrow.buyer_id <> v_buyer_id then
    raise exception 'This escrow is not available to your account' using errcode = '42501';
  end if;

  if v_order.status = 'completed' then
    if v_escrow.status <> 'released' then
      raise exception 'The completed purchase has an invalid escrow state' using errcode = '55000';
    end if;

    select exists (
        select 1
        from public.wallet_transactions wt
        join public.wallets w on w.id = wt.wallet_id
        where wt.type = 'credit'
          and wt.reference_type = 'order'
          and wt.reference_id = v_order.id::text
          and wt.amount = v_order.amount
          and wt.currency = v_order.currency
          and w.user_id = v_escrow.seller_id
          and w.currency = v_order.currency
      ) into v_credit_exists;

    if v_credit_exists then
      if exists (
        select 1 from public.payouts p
        where p.order_id = v_order.id
          and p.seller_id = v_escrow.seller_id
          and p.amount = v_order.amount
          and p.currency = v_order.currency
          and p.status = 'completed'
          and p.provider in ('giftly_wallet', 'simulated')
      ) then
        return;
      end if;

      raise exception 'The completed purchase has inconsistent seller settlement records' using errcode = '55000';
    end if;

    if exists (
      select 1 from public.wallet_transactions wt
      where wt.type = 'credit'
        and wt.reference_type = 'order'
        and wt.reference_id = v_order.id::text
    ) then
      raise exception 'The completed purchase has a conflicting wallet settlement entry' using errcode = '55000';
    end if;

    if not exists (
      select 1 from public.payouts p
      where p.order_id = v_order.id
        and p.seller_id = v_escrow.seller_id
        and p.amount = v_order.amount
        and p.currency = v_order.currency
        and p.status = 'completed'
        and p.provider in ('giftly_wallet', 'simulated')
    ) then
      raise exception 'The completed purchase is missing its simulated seller settlement record' using errcode = '55000';
    end if;

    v_recovery := true;
  elsif v_order.status <> 'delivered' or v_escrow.status <> 'release_pending' then
    raise exception 'This purchase is not awaiting buyer confirmation' using errcode = '55000';
  end if;

  if not v_recovery and not exists (
    select 1 from public.deliveries d
    where d.order_id = v_order.id
      and d.buyer_id = v_buyer_id
      and d.status = 'delivered'
  ) then
    raise exception 'The gift card has not been delivered' using errcode = '55000';
  end if;

  select t.metadata->>'brand' into v_brand
  from public.transactions t
  where t.order_id = v_order.id
    and t.user_id = v_buyer_id
    and t.type = 'purchase';

  v_wallet_reference := 'WALLET-ORDER-' || v_order.id::text;

  if not v_recovery then
    update public.orders set status = 'completed' where id = v_order.id;
    update public.escrow_transactions
    set status = 'released', buyer_confirmed_at = v_now, released_at = v_now
    where id = v_escrow.id;
  end if;

  insert into public.wallets (user_id, currency, balance, status)
  values (v_escrow.seller_id, v_order.currency, v_order.amount, 'active')
  on conflict (user_id, currency) do update
    set balance = public.wallets.balance + excluded.balance,
        updated_at = v_now
    where public.wallets.status = 'active'
  returning id into v_wallet_id;

  if v_wallet_id is null then
    raise exception 'The seller wallet for this currency is not active' using errcode = '55000';
  end if;

  insert into public.wallet_transactions (
    wallet_id, type, amount, currency, reference_type, reference_id, description
  )
  values (
    v_wallet_id,
    'credit',
    v_order.amount,
    v_order.currency,
    'order',
    v_order.id::text,
    'Marketplace sale settlement credited to Giftly wallet.'
  );

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
    set fee_amount = 0,
        net_amount = v_order.amount,
        status = 'completed',
        provider = 'giftly_wallet',
        provider_reference = v_wallet_reference,
        failure_reason = null,
        processed_at = v_now
    where id = v_payout.id;
  else
    insert into public.payouts (
      seller_id, order_id, amount, currency, fee_amount, net_amount,
      status, provider, provider_reference, processed_at
    )
    values (
      v_escrow.seller_id, v_order.id, v_order.amount, v_order.currency,
      0, v_order.amount, 'completed', 'giftly_wallet', v_wallet_reference, v_now
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
    set amount = v_order.amount,
        currency = v_order.currency,
        status = 'completed',
        provider = 'giftly_wallet',
        provider_reference = v_wallet_reference,
        metadata = jsonb_build_object(
          'simulated', true,
          'seller_id', v_escrow.seller_id,
          'brand', v_brand,
          'payout_status', 'completed',
          'settlement_destination', 'giftly_wallet',
          'processed_at', v_now,
          'description', 'Marketplace sale settlement credited to the seller Giftly wallet.'
        )
    where id = v_payout_transaction_id;
  else
    insert into public.transactions (
      user_id, order_id, type, amount, currency, status, provider, provider_reference, metadata
    )
    values (
      v_escrow.seller_id, v_order.id, 'payout', v_order.amount, v_order.currency,
      'completed', 'giftly_wallet', v_wallet_reference,
      jsonb_build_object(
        'simulated', true,
        'seller_id', v_escrow.seller_id,
        'brand', v_brand,
        'payout_status', 'completed',
        'settlement_destination', 'giftly_wallet',
        'processed_at', v_now,
        'description', 'Marketplace sale settlement credited to the seller Giftly wallet.'
      )
    );
  end if;
end;
$$;

alter function public.confirm_marketplace_gift_card_received(uuid) owner to postgres;
revoke all on function public.confirm_marketplace_gift_card_received(uuid) from public, anon, authenticated;
grant execute on function public.confirm_marketplace_gift_card_received(uuid) to authenticated;
