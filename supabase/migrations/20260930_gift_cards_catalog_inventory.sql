create table if not exists public.gift_card_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text not null default 'Gift',
  color text not null default '#f1edf8',
  accent text not null default '#6047bf',
  sort_order integer not null default 0,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gift_card_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  logo_url text,
  description text,
  category text,
  country text,
  supported_currencies text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.gift_card_brands(id) on delete restrict,
  category_id uuid not null references public.gift_card_categories(id) on delete restrict,
  title text not null,
  slug text not null unique,
  description text,
  country text not null,
  currency text not null,
  denomination numeric(12, 2) not null check (denomination > 0),
  discount_percent numeric(5, 2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  image_url text,
  display_color text not null default '#f1edf8',
  display_accent text not null default '#6047bf',
  short_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gift_card_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  gift_card_id uuid references public.gift_cards(id) on delete set null,
  reference_id text not null unique,
  brand text not null,
  country text,
  currency text,
  card_type text,
  masked_card_number text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'requires_review', 'verified', 'partially_verified', 'rejected', 'failed')),
  balance_status text not null default 'pending'
    check (balance_status in ('pending', 'verified', 'failed', 'not_checked')),
  mock_balance numeric(12, 2),
  card_status text not null default 'pending'
    check (card_status in ('pending', 'active', 'expired', 'invalid', 'unknown')),
  reason text,
  risk_status text not null default 'pending'
    check (risk_status in ('pending', 'low', 'medium', 'high')),
  risk_flags text[] not null default '{}',
  details_verified boolean not null default false,
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gift_card_inventory (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'available', 'reserved', 'sold', 'disabled')),
  sale_price numeric(12, 2) not null check (sale_price > 0),
  currency text not null,
  masked_card_number text,
  verification_id uuid references public.gift_card_verifications(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gift_cards_brand_id_idx
  on public.gift_cards (brand_id);
create index if not exists gift_cards_category_id_idx
  on public.gift_cards (category_id);
create index if not exists gift_cards_active_slug_idx
  on public.gift_cards (slug) where status = 'active';
create index if not exists gift_card_inventory_seller_id_idx
  on public.gift_card_inventory (seller_id);
create index if not exists gift_card_inventory_verification_id_idx
  on public.gift_card_inventory (verification_id);
create index if not exists gift_card_verifications_user_id_idx
  on public.gift_card_verifications (user_id);
create index if not exists gift_card_verifications_gift_card_id_idx
  on public.gift_card_verifications (gift_card_id);

create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    $1 in ('customer', 'admin', 'support', 'compliance', 'operations')
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = $1
    ),
    false
  );
$$;

alter function public.has_role(text) owner to postgres;
revoke all on function public.has_role(text) from public, anon;
grant execute on function public.has_role(text) to authenticated, service_role;

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.created_at is distinct from old.created_at then
    raise exception 'Profile identity fields are controlled fields';
  end if;

  if (
    new.role is distinct from old.role
    or new.status is distinct from old.status
  ) and not (
    public.has_role('admin')
    or public.has_role('support')
    or public.has_role('compliance')
    or public.has_role('operations')
  ) then
    raise exception 'Only privileged staff can change profile role or status';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_security_fields() from public, anon;
grant execute on function public.protect_profile_security_fields() to authenticated, service_role;

drop trigger if exists profiles_protect_security_fields on public.profiles;
create trigger profiles_protect_security_fields
before update on public.profiles
for each row execute function public.protect_profile_security_fields();

drop policy if exists "Profiles can be read by owner or privileged staff" on public.profiles;
create policy "Profiles can be read by owner or privileged staff"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

drop policy if exists "Users can update only their own profile fields" on public.profiles;
create policy "Users can update only their own profile fields"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Privileged staff can manage profile records" on public.profiles;
create policy "Privileged staff can manage profile records"
on public.profiles for update to authenticated
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

create or replace function public.set_gift_catalog_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_gift_card_inventory_owner_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (
    public.has_role('admin')
    or public.has_role('support')
    or public.has_role('compliance')
    or public.has_role('operations')
  ) and (
    new.seller_id is distinct from old.seller_id
    or new.gift_card_id is distinct from old.gift_card_id
    or new.verification_id is distinct from old.verification_id
    or new.status is distinct from old.status
    or new.currency is distinct from old.currency
  ) then
    raise exception 'Inventory ownership, verification, status, and currency are controlled fields';
  end if;

  return new;
end;
$$;

drop trigger if exists gift_card_categories_set_updated_at on public.gift_card_categories;
create trigger gift_card_categories_set_updated_at
before update on public.gift_card_categories
for each row execute function public.set_gift_catalog_updated_at();

drop trigger if exists gift_card_brands_set_updated_at on public.gift_card_brands;
create trigger gift_card_brands_set_updated_at
before update on public.gift_card_brands
for each row execute function public.set_gift_catalog_updated_at();

drop trigger if exists gift_cards_set_updated_at on public.gift_cards;
create trigger gift_cards_set_updated_at
before update on public.gift_cards
for each row execute function public.set_gift_catalog_updated_at();

drop trigger if exists gift_card_verifications_set_updated_at on public.gift_card_verifications;
create trigger gift_card_verifications_set_updated_at
before update on public.gift_card_verifications
for each row execute function public.set_gift_catalog_updated_at();

drop trigger if exists gift_card_inventory_set_updated_at on public.gift_card_inventory;
create trigger gift_card_inventory_set_updated_at
before update on public.gift_card_inventory
for each row execute function public.set_gift_catalog_updated_at();

drop trigger if exists gift_card_inventory_protect_owner_fields on public.gift_card_inventory;
create trigger gift_card_inventory_protect_owner_fields
before update on public.gift_card_inventory
for each row execute function public.protect_gift_card_inventory_owner_fields();

comment on table public.gift_card_verifications is
  'Prototype verification metadata only; no retailer balance or OCR result is authoritative.';
comment on column public.gift_card_verifications.mock_balance is
  'Prototype-only balance field; never represents a retailer-verified balance.';

alter table public.gift_card_categories enable row level security;
alter table public.gift_card_brands enable row level security;
alter table public.gift_cards enable row level security;
alter table public.gift_card_inventory enable row level security;
alter table public.gift_card_verifications enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.gift_card_categories, public.gift_card_brands, public.gift_cards to anon, authenticated;
grant insert, update, delete on public.gift_card_categories, public.gift_card_brands, public.gift_cards to authenticated;
grant select, insert, update, delete on public.gift_card_inventory to authenticated;
grant select, insert, update on public.gift_card_verifications to authenticated;

drop policy if exists "Active gift card categories are public" on public.gift_card_categories;
create policy "Active gift card categories are public"
on public.gift_card_categories for select to anon, authenticated
using (status = 'active');

drop policy if exists "Staff manage gift card categories" on public.gift_card_categories;
create policy "Staff manage gift card categories"
on public.gift_card_categories for all to authenticated
using (
  public.has_role('admin') or public.has_role('support')
  or public.has_role('compliance') or public.has_role('operations')
)
with check (
  public.has_role('admin') or public.has_role('support')
  or public.has_role('compliance') or public.has_role('operations')
);

drop policy if exists "Active gift card brands are public" on public.gift_card_brands;
create policy "Active gift card brands are public"
on public.gift_card_brands for select to anon, authenticated
using (status = 'active');

drop policy if exists "Staff manage gift card brands" on public.gift_card_brands;
create policy "Staff manage gift card brands"
on public.gift_card_brands for all to authenticated
using (
  public.has_role('admin') or public.has_role('support')
  or public.has_role('compliance') or public.has_role('operations')
)
with check (
  public.has_role('admin') or public.has_role('support')
  or public.has_role('compliance') or public.has_role('operations')
);

drop policy if exists "Active gift cards are public" on public.gift_cards;
create policy "Active gift cards are public"
on public.gift_cards for select to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1 from public.gift_card_brands b
    where b.id = gift_cards.brand_id and b.status = 'active'
  )
  and exists (
    select 1 from public.gift_card_categories c
    where c.id = gift_cards.category_id and c.status = 'active'
  )
);

drop policy if exists "Staff manage gift cards" on public.gift_cards;
create policy "Staff manage gift cards"
on public.gift_cards for all to authenticated
using (
  public.has_role('admin') or public.has_role('support')
  or public.has_role('compliance') or public.has_role('operations')
)
with check (
  public.has_role('admin') or public.has_role('support')
  or public.has_role('compliance') or public.has_role('operations')
);

drop policy if exists "Sellers read their own gift card inventory" on public.gift_card_inventory;
create policy "Sellers read their own gift card inventory"
on public.gift_card_inventory for select to authenticated
using (seller_id = auth.uid());

drop policy if exists "Sellers add pending gift card inventory" on public.gift_card_inventory;
create policy "Sellers add pending gift card inventory"
on public.gift_card_inventory for insert to authenticated
with check (
  seller_id = auth.uid()
  and status = 'pending'
  and (
    verification_id is null
    or exists (
      select 1 from public.gift_card_verifications v
      where v.id = verification_id
        and v.user_id = auth.uid()
        and v.gift_card_id = gift_card_inventory.gift_card_id
    )
  )
);

drop policy if exists "Sellers update their own gift card inventory" on public.gift_card_inventory;
create policy "Sellers update their own gift card inventory"
on public.gift_card_inventory for update to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

drop policy if exists "Sellers delete their own gift card inventory" on public.gift_card_inventory;
create policy "Sellers delete their own gift card inventory"
on public.gift_card_inventory for delete to authenticated
using (seller_id = auth.uid());

drop policy if exists "Staff manage gift card inventory" on public.gift_card_inventory;
create policy "Staff manage gift card inventory"
on public.gift_card_inventory for all to authenticated
using (
  public.has_role('admin') or public.has_role('support')
  or public.has_role('compliance') or public.has_role('operations')
)
with check (
  public.has_role('admin') or public.has_role('support')
  or public.has_role('compliance') or public.has_role('operations')
);

drop policy if exists "Users read their own gift card verifications" on public.gift_card_verifications;
create policy "Users read their own gift card verifications"
on public.gift_card_verifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users submit pending gift card verifications" on public.gift_card_verifications;
create policy "Users submit pending gift card verifications"
on public.gift_card_verifications for insert to authenticated
with check (
  user_id = auth.uid()
  and verification_status = 'pending'
  and balance_status = 'pending'
  and card_status = 'pending'
  and risk_status = 'pending'
  and mock_balance is null
  and verified_at is null
  and details_verified = false
  and cardinality(risk_flags) = 0
);

drop policy if exists "Staff read gift card verifications" on public.gift_card_verifications;
create policy "Staff read gift card verifications"
on public.gift_card_verifications for select to authenticated
using (
  public.has_role('admin') or public.has_role('support')
  or public.has_role('compliance') or public.has_role('operations')
);

drop policy if exists "Staff review gift card verifications" on public.gift_card_verifications;
create policy "Staff review gift card verifications"
on public.gift_card_verifications for update to authenticated
using (
  public.has_role('admin') or public.has_role('support')
  or public.has_role('compliance') or public.has_role('operations')
)
with check (
  public.has_role('admin') or public.has_role('support')
  or public.has_role('compliance') or public.has_role('operations')
);