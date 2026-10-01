create extension if not exists pgcrypto;

create or replace function public.set_marketplace_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.gift_card_inventory(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  listing_type text not null check (listing_type in ('instant', 'fixed_price', 'auction')),
  asking_price numeric(14, 2) not null check (asking_price > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'active', 'reserved', 'sold', 'cancelled', 'expired', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  listing_id uuid not null references public.listings(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (status in ('pending', 'payment_pending', 'paid', 'processing', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  type text not null check (type in ('purchase', 'refund', 'fee', 'payout', 'adjustment')),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'reversed')),
  provider text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  status text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, currency)
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  type text not null check (type in ('credit', 'debit', 'hold', 'release', 'refund', 'adjustment')),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reference_type text,
  reference_id text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.escrow_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (status in ('pending', 'funded', 'held', 'release_pending', 'released', 'refund_pending', 'refunded', 'disputed', 'cancelled')),
  funded_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  starting_price numeric(14, 2) not null check (starting_price > 0),
  current_price numeric(14, 2) not null check (current_price >= starting_price),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  minimum_increment numeric(14, 2) not null check (minimum_increment > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'ended', 'cancelled', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active', 'winning', 'outbid', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  fee_amount numeric(14, 2) not null default 0 check (fee_amount >= 0),
  net_amount numeric(14, 2) not null check (net_amount >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'blocked', 'cancelled')),
  provider text,
  provider_reference text,
  failure_reason text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'under_review', 'awaiting_evidence', 'resolved', 'rejected', 'cancelled')),
  resolution text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  evidence_type text not null,
  storage_path text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  inventory_id uuid references public.gift_card_inventory(id) on delete set null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'confirmed', 'dismissed', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  risk_score integer not null check (risk_score >= 0 and risk_score <= 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  delivery_type text not null check (delivery_type in ('in_app', 'email', 'sms')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'failed', 'cancelled')),
  delivered_at timestamptz,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists listings_seller_id_idx on public.listings (seller_id);
create index if not exists listings_inventory_id_idx on public.listings (inventory_id);
create index if not exists listings_status_idx on public.listings (status);
create index if not exists listings_created_at_idx on public.listings (created_at desc);

create index if not exists orders_buyer_id_idx on public.orders (buyer_id);
create index if not exists orders_listing_id_idx on public.orders (listing_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_order_id_idx on public.transactions (order_id);
create index if not exists transactions_type_idx on public.transactions (type);
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);

create index if not exists wallets_user_id_idx on public.wallets (user_id);
create index if not exists wallets_status_idx on public.wallets (status);

create index if not exists wallet_transactions_wallet_id_idx on public.wallet_transactions (wallet_id);
create index if not exists wallet_transactions_type_idx on public.wallet_transactions (type);
create index if not exists wallet_transactions_created_at_idx on public.wallet_transactions (created_at desc);

create index if not exists escrow_transactions_order_id_idx on public.escrow_transactions (order_id);
create index if not exists escrow_transactions_buyer_id_idx on public.escrow_transactions (buyer_id);
create index if not exists escrow_transactions_seller_id_idx on public.escrow_transactions (seller_id);
create index if not exists escrow_transactions_status_idx on public.escrow_transactions (status);
create index if not exists escrow_transactions_created_at_idx on public.escrow_transactions (created_at desc);

create index if not exists auctions_listing_id_idx on public.auctions (listing_id);
create index if not exists auctions_seller_id_idx on public.auctions (seller_id);
create index if not exists auctions_status_idx on public.auctions (status);
create index if not exists auctions_created_at_idx on public.auctions (created_at desc);

create index if not exists auction_bids_auction_id_idx on public.auction_bids (auction_id);
create index if not exists auction_bids_bidder_id_idx on public.auction_bids (bidder_id);
create index if not exists auction_bids_status_idx on public.auction_bids (status);
create index if not exists auction_bids_created_at_idx on public.auction_bids (created_at desc);

create index if not exists payouts_seller_id_idx on public.payouts (seller_id);
create index if not exists payouts_order_id_idx on public.payouts (order_id);
create index if not exists payouts_status_idx on public.payouts (status);
create index if not exists payouts_created_at_idx on public.payouts (created_at desc);

create index if not exists disputes_order_id_idx on public.disputes (order_id);
create index if not exists disputes_opened_by_idx on public.disputes (opened_by);
create index if not exists disputes_status_idx on public.disputes (status);
create index if not exists disputes_created_at_idx on public.disputes (created_at desc);

create index if not exists dispute_evidence_dispute_id_idx on public.dispute_evidence (dispute_id);
create index if not exists dispute_evidence_uploaded_by_idx on public.dispute_evidence (uploaded_by);

create index if not exists fraud_flags_user_id_idx on public.fraud_flags (user_id);
create index if not exists fraud_flags_order_id_idx on public.fraud_flags (order_id);
create index if not exists fraud_flags_inventory_id_idx on public.fraud_flags (inventory_id);
create index if not exists fraud_flags_status_idx on public.fraud_flags (status);
create index if not exists fraud_flags_created_at_idx on public.fraud_flags (created_at desc);

create index if not exists risk_events_user_id_idx on public.risk_events (user_id);
create index if not exists risk_events_event_type_idx on public.risk_events (event_type);
create index if not exists risk_events_created_at_idx on public.risk_events (created_at desc);

create index if not exists deliveries_order_id_idx on public.deliveries (order_id);
create index if not exists deliveries_buyer_id_idx on public.deliveries (buyer_id);
create index if not exists deliveries_status_idx on public.deliveries (status);
create index if not exists deliveries_created_at_idx on public.deliveries (created_at desc);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_read_at_idx on public.notifications (read_at);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_entity_type_idx on public.audit_logs (entity_type);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

create or replace function public.protect_listing_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if (
    new.seller_id is distinct from old.seller_id
    or new.inventory_id is distinct from old.inventory_id
    or new.status is distinct from old.status
  ) and not (
    public.has_role('admin')
    or public.has_role('support')
    or public.has_role('compliance')
    or public.has_role('operations')
  ) then
    raise exception 'Seller ownership, inventory ownership, and listing status are controlled fields';
  end if;

  return new;
end;
$$;

create or replace function public.protect_auction_bids()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if old.id is not null and (
    old.auction_id is distinct from new.auction_id
    or old.bidder_id is distinct from new.bidder_id
    or old.amount is distinct from new.amount
    or old.currency is distinct from new.currency
  ) then
    raise exception 'Historical auction bid details are immutable';
  end if;

  return new;
end;
$$;

create or replace function public.protect_financial_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  raise exception 'Direct client-side financial mutation is not allowed';
end;
$$;

create or replace function public.protect_readonly_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.wallet_id is distinct from old.wallet_id
    or new.type is distinct from old.type
    or new.amount is distinct from old.amount
    or new.currency is distinct from old.currency
    or new.reference_type is distinct from old.reference_type
    or new.reference_id is distinct from old.reference_id
    or new.description is distinct from old.description then
    raise exception 'Wallet ledger fields are controlled';
  end if;

  return new;
end;
$$;

create or replace function public.protect_notification_read_state()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.data is distinct from old.data
    or new.created_at is distinct from old.created_at then
    raise exception 'Notification content fields are immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_marketplace_updated_at();

drop trigger if exists listings_protect_controlled_fields on public.listings;
create trigger listings_protect_controlled_fields
before update on public.listings
for each row execute function public.protect_listing_fields();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_marketplace_updated_at();

drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at
before update on public.wallets
for each row execute function public.set_marketplace_updated_at();

drop trigger if exists escrow_transactions_set_updated_at on public.escrow_transactions;
create trigger escrow_transactions_set_updated_at
before update on public.escrow_transactions
for each row execute function public.set_marketplace_updated_at();

drop trigger if exists auctions_set_updated_at on public.auctions;
create trigger auctions_set_updated_at
before update on public.auctions
for each row execute function public.set_marketplace_updated_at();

drop trigger if exists auction_bids_protect_history on public.auction_bids;
create trigger auction_bids_protect_history
before update on public.auction_bids
for each row execute function public.protect_auction_bids();

drop trigger if exists payouts_set_updated_at on public.payouts;
create trigger payouts_set_updated_at
before update on public.payouts
for each row execute function public.set_marketplace_updated_at();

drop trigger if exists disputes_set_updated_at on public.disputes;
create trigger disputes_set_updated_at
before update on public.disputes
for each row execute function public.set_marketplace_updated_at();

drop trigger if exists deliveries_set_updated_at on public.deliveries;
create trigger deliveries_set_updated_at
before update on public.deliveries
for each row execute function public.set_marketplace_updated_at();

drop trigger if exists notifications_protect_read_state on public.notifications;
create trigger notifications_protect_read_state
before update on public.notifications
for each row execute function public.protect_notification_read_state();

alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.transactions enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.auctions enable row level security;
alter table public.auction_bids enable row level security;
alter table public.payouts enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_evidence enable row level security;
alter table public.fraud_flags enable row level security;
alter table public.risk_events enable row level security;
alter table public.deliveries enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.listings, public.orders, public.transactions, public.wallets, public.wallet_transactions, public.escrow_transactions, public.auctions, public.auction_bids, public.payouts, public.disputes, public.dispute_evidence, public.deliveries, public.notifications, public.fraud_flags, public.risk_events, public.audit_logs to authenticated;

drop policy if exists "Sellers and staff can read listings" on public.listings;
create policy "Sellers and staff can read listings"
on public.listings for select to authenticated
using (
  seller_id = auth.uid()
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

drop policy if exists "Sellers can insert their own listings" on public.listings;
create policy "Sellers can insert their own listings"
on public.listings for insert to authenticated
with check (
  seller_id = auth.uid()
  and exists (
    select 1 from public.gift_card_inventory inv
    where inv.id = inventory_id and inv.seller_id = auth.uid()
  )
);

drop policy if exists "Sellers can update their own listings" on public.listings;
create policy "Sellers can update their own listings"
on public.listings for update to authenticated
using (seller_id = auth.uid())
with check (
  seller_id = auth.uid()
  and exists (
    select 1 from public.gift_card_inventory inv
    where inv.id = inventory_id and inv.seller_id = auth.uid()
  )
);

drop policy if exists "Staff can review listings" on public.listings;
create policy "Staff can review listings"
on public.listings for update to authenticated
using (
  public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
)
with check (
  public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

drop policy if exists "Listings cannot be deleted by clients" on public.listings;
create policy "Listings cannot be deleted by clients"
on public.listings for delete to authenticated
using (false);

drop policy if exists "Buyers can read their own orders" on public.orders;
create policy "Buyers can read their own orders"
on public.orders for select to authenticated
using (
  buyer_id = auth.uid()
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

drop policy if exists "Staff can review orders" on public.orders;
create policy "Staff can review orders"
on public.orders for update to authenticated
using (
  public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
)
with check (
  public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

drop policy if exists "Orders cannot be inserted or deleted by clients" on public.orders;
create policy "Orders cannot be inserted or deleted by clients"
on public.orders for insert to authenticated
with check (false);

create policy "Orders cannot be deleted by clients"
on public.orders for delete to authenticated
using (false);

drop policy if exists "Users can read their own transactions" on public.transactions;
create policy "Users can read their own transactions"
on public.transactions for select to authenticated
using (
  user_id = auth.uid()
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

drop policy if exists "Transactions are server controlled" on public.transactions;
create policy "Transactions are server controlled"
on public.transactions for insert to authenticated
with check (false);

create policy "Transactions are server controlled for updates" on public.transactions for update to authenticated
using (false)
with check (false);

create policy "Transactions cannot be deleted by clients" on public.transactions for delete to authenticated
using (false);

drop policy if exists "Users can read their own wallets" on public.wallets;
create policy "Users can read their own wallets"
on public.wallets for select to authenticated
using (
  user_id = auth.uid()
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

create policy "Wallets are server controlled" on public.wallets for insert to authenticated
with check (false);

create policy "Wallets are server controlled on update" on public.wallets for update to authenticated
using (false)
with check (false);

create policy "Wallets cannot be deleted by clients" on public.wallets for delete to authenticated
using (false);

drop policy if exists "Users can read their own wallet transactions" on public.wallet_transactions;
create policy "Users can read their own wallet transactions"
on public.wallet_transactions for select to authenticated
using (
  exists (
    select 1 from public.wallets w
    where w.id = wallet_id and w.user_id = auth.uid()
  )
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

create policy "Wallet transactions are server controlled" on public.wallet_transactions for insert to authenticated
with check (false);

create policy "Wallet transactions are immutable" on public.wallet_transactions for update to authenticated
using (false)
with check (false);

create policy "Wallet transactions cannot be deleted by clients" on public.wallet_transactions for delete to authenticated
using (false);

drop policy if exists "Buyers and sellers can read escrow associated with them" on public.escrow_transactions;
create policy "Buyers and sellers can read escrow associated with them"
on public.escrow_transactions for select to authenticated
using (
  (buyer_id = auth.uid() or seller_id = auth.uid())
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

create policy "Escrow is server controlled" on public.escrow_transactions for insert to authenticated
with check (false);

create policy "Escrow state cannot change via client" on public.escrow_transactions for update to authenticated
using (false)
with check (false);

create policy "Escrow cannot be deleted by clients" on public.escrow_transactions for delete to authenticated
using (false);

drop policy if exists "Sellers and staff can read auctions" on public.auctions;
create policy "Sellers and staff can read auctions"
on public.auctions for select to authenticated
using (
  seller_id = auth.uid()
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

drop policy if exists "Sellers can insert their own auctions" on public.auctions;
create policy "Sellers can insert their own auctions"
on public.auctions for insert to authenticated
with check (seller_id = auth.uid());

drop policy if exists "Sellers can update their own auctions" on public.auctions;
create policy "Sellers can update their own auctions"
on public.auctions for update to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

drop policy if exists "Staff can review auctions" on public.auctions;
create policy "Staff can review auctions"
on public.auctions for update to authenticated
using (
  public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
)
with check (
  public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

create policy "Auctions cannot be deleted by clients" on public.auctions for delete to authenticated
using (false);

drop policy if exists "Bidders can read their own auction bids" on public.auction_bids;
create policy "Bidders can read their own auction bids"
on public.auction_bids for select to authenticated
using (
  bidder_id = auth.uid()
  or exists (
    select 1 from public.auctions a
    where a.id = auction_id and a.seller_id = auth.uid()
  )
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

drop policy if exists "Bidders can insert own auction bids" on public.auction_bids;
create policy "Bidders can insert own auction bids"
on public.auction_bids for insert to authenticated
with check (bidder_id = auth.uid());

create policy "Auction bids are immutable" on public.auction_bids for update to authenticated
using (false)
with check (false);

create policy "Auction bids cannot be deleted by clients" on public.auction_bids for delete to authenticated
using (false);

drop policy if exists "Sellers can read their own payouts" on public.payouts;
create policy "Sellers can read their own payouts"
on public.payouts for select to authenticated
using (
  seller_id = auth.uid()
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

create policy "Payouts are server controlled" on public.payouts for insert to authenticated
with check (false);

create policy "Payouts state cannot change via client" on public.payouts for update to authenticated
using (false)
with check (false);

create policy "Payouts cannot be deleted by clients" on public.payouts for delete to authenticated
using (false);

drop policy if exists "Users can read their own disputes" on public.disputes;
create policy "Users can read their own disputes"
on public.disputes for select to authenticated
using (
  opened_by = auth.uid()
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

drop policy if exists "Users can create disputes for own orders" on public.disputes;
create policy "Users can create disputes for own orders"
on public.disputes for insert to authenticated
with check (
  opened_by = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_id and o.buyer_id = auth.uid()
  )
);

create policy "Disputes are review-only for clients" on public.disputes for update to authenticated
using (false)
with check (false);

create policy "Disputes cannot be deleted by clients" on public.disputes for delete to authenticated
using (false);

drop policy if exists "Users can read their own dispute evidence" on public.dispute_evidence;
create policy "Users can read their own dispute evidence"
on public.dispute_evidence for select to authenticated
using (
  uploaded_by = auth.uid()
  or exists (
    select 1
    from public.disputes d
    where d.id = dispute_id and d.opened_by = auth.uid()
  )
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

create policy "Users can upload dispute evidence" on public.dispute_evidence for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.disputes d
    where d.id = dispute_id and d.opened_by = auth.uid()
  )
);

create policy "Dispute evidence is immutable" on public.dispute_evidence for update to authenticated
using (false)
with check (false);

create policy "Dispute evidence cannot be deleted by clients" on public.dispute_evidence for delete to authenticated
using (false);

drop policy if exists "Fraud flags are staff-only" on public.fraud_flags;
create policy "Fraud flags are staff-only"
on public.fraud_flags for select to authenticated
using (
  public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

create policy "Fraud flags cannot be client modified" on public.fraud_flags for insert to authenticated
with check (false);

create policy "Fraud flags cannot be client modified on update" on public.fraud_flags for update to authenticated
using (false)
with check (false);

create policy "Fraud flags cannot be client deleted" on public.fraud_flags for delete to authenticated
using (false);

drop policy if exists "Risk events are staff-only" on public.risk_events;
create policy "Risk events are staff-only"
on public.risk_events for select to authenticated
using (
  public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

create policy "Risk events cannot be client modified" on public.risk_events for insert to authenticated
with check (false);

create policy "Risk events cannot be client modified on update" on public.risk_events for update to authenticated
using (false)
with check (false);

create policy "Risk events cannot be client deleted" on public.risk_events for delete to authenticated
using (false);

drop policy if exists "Buyers can read their own deliveries" on public.deliveries;
create policy "Buyers can read their own deliveries"
on public.deliveries for select to authenticated
using (
  buyer_id = auth.uid()
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

create policy "Deliveries are server controlled" on public.deliveries for insert to authenticated
with check (false);

create policy "Deliveries state cannot change via client" on public.deliveries for update to authenticated
using (false)
with check (false);

create policy "Deliveries cannot be deleted by clients" on public.deliveries for delete to authenticated
using (false);

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
on public.notifications for select to authenticated
using (
  user_id = auth.uid()
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

drop policy if exists "Staff can create operational notifications" on public.notifications;
create policy "Staff can create operational notifications"
on public.notifications for insert to authenticated
with check (
  (
    public.has_role('admin')
    or public.has_role('support')
    or public.has_role('compliance')
    or public.has_role('operations')
  )
  and user_id is not null
);

create policy "Users can update their own notification read state" on public.notifications for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
);

create policy "Notifications cannot be deleted by clients" on public.notifications for delete to authenticated
using (false);

drop policy if exists "Staff can read audit logs" on public.audit_logs;
create policy "Staff can read audit logs"
on public.audit_logs for select to authenticated
using (
  public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

create policy "Audit logs are immutable" on public.audit_logs for insert to authenticated
with check (false);

create policy "Audit logs cannot be client modified" on public.audit_logs for update to authenticated
using (false)
with check (false);

create policy "Audit logs cannot be deleted by clients" on public.audit_logs for delete to authenticated
using (false);
