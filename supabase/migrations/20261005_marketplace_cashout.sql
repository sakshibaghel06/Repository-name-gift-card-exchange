alter table public.payouts
  alter column order_id drop not null,
  add column payout_type text not null default 'marketplace_settlement',
  add column idempotency_key uuid;

alter table public.payouts
  add constraint payouts_payout_type_check
    check (payout_type in ('marketplace_settlement', 'cashout')),
  add constraint payouts_type_order_idempotency_check
    check (
      (payout_type = 'marketplace_settlement' and order_id is not null and idempotency_key is null)
      or
      (payout_type = 'cashout' and order_id is null and idempotency_key is not null)
    );

create unique index payouts_cashout_seller_idempotency_key_uq
  on public.payouts (seller_id, idempotency_key)
  where payout_type = 'cashout';

create unique index wallet_transactions_payout_debit_uq
  on public.wallet_transactions (reference_type, reference_id)
  where reference_type = 'payout' and type = 'debit';

create unique index wallet_transactions_payout_refund_uq
  on public.wallet_transactions (reference_type, reference_id)
  where reference_type = 'payout' and type = 'credit';

create or replace function public.request_marketplace_cashout(
  p_currency text,
  p_amount numeric,
  p_idempotency_key uuid
)
returns table (
  payout_id uuid,
  wallet_id uuid,
  amount numeric,
  currency text,
  status text,
  remaining_balance numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_seller_id uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_wallet_id uuid;
  v_payout public.payouts%rowtype;
  v_remaining_balance numeric(14, 2);
  v_now timestamptz := now();
begin
  if v_seller_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'Choose a valid three-letter currency' using errcode = '22023';
  end if;

  if p_amount is null
    or p_amount::text in ('NaN', 'Infinity', '-Infinity')
    or p_amount <= 0
    or p_amount <> round(p_amount, 2)
    or p_amount > 999999999999.99 then
    raise exception 'Enter an amount greater than zero with at most two decimal places' using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'A cash-out request key is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_seller_id::text || ':' || p_idempotency_key::text, 0)
  );

  select p.* into v_payout
  from public.payouts as p
  where p.seller_id = v_seller_id
    and p.payout_type = 'cashout'
    and p.idempotency_key = p_idempotency_key;

  if found then
    if v_payout.amount <> p_amount or v_payout.currency <> p_currency then
      raise exception 'This request key was already used for a different cash-out' using errcode = '22023';
    end if;

    select w.id, w.balance into v_wallet_id, v_remaining_balance
    from public.wallets as w
    where w.user_id = v_seller_id
      and w.currency = v_payout.currency
    for update;

    if not found then
      raise exception 'The wallet for this cash-out could not be found' using errcode = '55000';
    end if;

    return query
    select v_payout.id, v_wallet_id, v_payout.amount, v_payout.currency,
           v_payout.status, v_remaining_balance, v_payout.created_at;
    return;
  end if;

  select w.* into v_wallet
  from public.wallets as w
  where w.user_id = v_seller_id
    and w.currency = p_currency
  for update;

  if not found then
    raise exception 'No marketplace wallet exists for %' , p_currency using errcode = 'P0002';
  end if;
  if v_wallet.status <> 'active' then
    raise exception 'The % marketplace wallet is not active' , p_currency using errcode = '55000';
  end if;
  if v_wallet.balance < p_amount then
    raise exception 'Insufficient marketplace wallet balance' using errcode = '22003';
  end if;

  insert into public.payouts (
    seller_id, order_id, payout_type, idempotency_key, amount, currency,
    fee_amount, net_amount, status, provider
  )
  values (
    v_seller_id, null, 'cashout', p_idempotency_key, p_amount, p_currency,
    0, p_amount, 'pending', 'giftly_demo'
  )
  returning * into v_payout;

  update public.wallets as w
  set balance = w.balance - p_amount
  where w.id = v_wallet.id
    and w.status = 'active'
    and w.balance >= p_amount
  returning w.balance into v_remaining_balance;

  if not found then
    raise exception 'Insufficient marketplace wallet balance' using errcode = '22003';
  end if;

  insert into public.wallet_transactions (
    wallet_id, type, amount, currency, reference_type, reference_id, description
  )
  values (
    v_wallet.id, 'debit', p_amount, p_currency, 'payout', v_payout.id::text,
    'Marketplace cash-out request reserved from wallet balance.'
  );

  return query
  select v_payout.id, v_wallet.id, v_payout.amount, v_payout.currency,
         v_payout.status, v_remaining_balance, v_payout.created_at;
end;
$$;

create or replace function public.simulate_marketplace_cashout_failure(p_payout_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_payout public.payouts%rowtype;
  v_wallet public.wallets%rowtype;
  v_now timestamptz := now();
begin
  if v_actor_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  if not (
    public.has_role('admin')
    or public.has_role('operations')
  ) then
    raise exception 'Only authorized operations staff can simulate a cash-out failure' using errcode = '42501';
  end if;

  select p.* into v_payout
  from public.payouts as p
  where p.id = p_payout_id
  for update;

  if not found or v_payout.payout_type <> 'cashout' then
    raise exception 'Cash-out request was not found' using errcode = 'P0002';
  end if;
  if v_payout.status not in ('pending', 'processing') then
    raise exception 'Only pending or processing cash-outs can fail' using errcode = '55000';
  end if;

  select w.* into v_wallet
  from public.wallets as w
  where w.user_id = v_payout.seller_id
    and w.currency = v_payout.currency
  for update;

  if not found then
    raise exception 'The seller wallet for this cash-out could not be found' using errcode = '55000';
  end if;

  update public.wallets as w
  set balance = w.balance + v_payout.amount
  where w.id = v_wallet.id
  returning w.* into v_wallet;

  insert into public.wallet_transactions (
    wallet_id, type, amount, currency, reference_type, reference_id, description
  )
  values (
    v_wallet.id, 'credit', v_payout.amount, v_payout.currency, 'payout', v_payout.id::text,
    'Marketplace cash-out failed; reserved funds returned to wallet.'
  );

  update public.payouts as p
  set status = 'failed',
      failure_reason = 'Simulated cash-out failure; funds returned to the marketplace wallet.',
      processed_at = v_now
  where p.id = v_payout.id;
end;
$$;

alter function public.request_marketplace_cashout(text, numeric, uuid) owner to postgres;
revoke all on function public.request_marketplace_cashout(text, numeric, uuid) from public, anon, authenticated;
grant execute on function public.request_marketplace_cashout(text, numeric, uuid) to authenticated;

alter function public.simulate_marketplace_cashout_failure(uuid) owner to postgres;
revoke all on function public.simulate_marketplace_cashout_failure(uuid) from public, anon, authenticated;
grant execute on function public.simulate_marketplace_cashout_failure(uuid) to authenticated;
