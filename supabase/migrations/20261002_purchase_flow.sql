create or replace function public.protect_listing_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
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
    or (
      current_user = 'postgres'
      and old.status = 'active'
      and new.status = 'reserved'
      and new.seller_id is not distinct from old.seller_id
      and new.inventory_id is not distinct from old.inventory_id
    )
  ) then
    raise exception 'Seller ownership, inventory ownership, and listing status are controlled fields';
  end if;

  return new;
end;
$$;

create or replace function public.purchase_marketplace_listing(p_listing_id uuid)
returns table (
  order_id uuid,
  escrow_id uuid,
  transaction_id uuid,
  listing_id uuid,
  seller_id uuid,
  amount numeric,
  currency text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_listing record;
  v_order_id uuid;
  v_escrow_id uuid;
  v_transaction_id uuid;
  v_created_at timestamptz;
begin
  if v_buyer_id is null then
    raise exception 'Authentication is required to purchase a listing' using errcode = '28000';
  end if;

  select
    l.id,
    l.seller_id,
    l.asking_price,
    l.currency,
    l.status,
    l.listing_type,
    i.verification_id,
    i.masked_card_number,
    coalesce(v.brand, b.name, gc.title) as brand,
    coalesce(v.country, gc.country) as country,
    v.mock_balance as face_value
  into v_listing
  from public.listings l
  join public.gift_card_inventory i on i.id = l.inventory_id
  join public.gift_cards gc on gc.id = i.gift_card_id
  join public.gift_card_brands b on b.id = gc.brand_id
  left join public.gift_card_verifications v on v.id = i.verification_id
  where l.id = p_listing_id
  for update of l;

  if not found then
    raise exception 'Listing was not found' using errcode = 'P0002';
  end if;

  if v_listing.status <> 'active' then
    raise exception 'Listing is not active' using errcode = '55000';
  end if;

  if v_listing.listing_type <> 'fixed_price' then
    raise exception 'Only fixed-price listings can be purchased' using errcode = '22023';
  end if;

  if v_listing.seller_id = v_buyer_id then
    raise exception 'You cannot purchase your own listing' using errcode = '22023';
  end if;

  insert into public.orders as inserted_order (buyer_id, listing_id, amount, currency, status)
  values (v_buyer_id, v_listing.id, v_listing.asking_price, v_listing.currency, 'pending')
  returning inserted_order.id, inserted_order.created_at into v_order_id, v_created_at;

  insert into public.escrow_transactions (
    order_id, buyer_id, seller_id, amount, currency, status
  )
  values (
    v_order_id, v_buyer_id, v_listing.seller_id, v_listing.asking_price,
    v_listing.currency, 'pending'
  )
  returning id into v_escrow_id;

  insert into public.transactions (
    user_id, order_id, type, amount, currency, status, metadata
  )
  values (
    v_buyer_id,
    v_order_id,
    'purchase',
    v_listing.asking_price,
    v_listing.currency,
    'pending',
    jsonb_strip_nulls(jsonb_build_object(
      'listing_id', v_listing.id,
      'seller_id', v_listing.seller_id,
      'brand', v_listing.brand,
      'country', v_listing.country,
      'face_value', v_listing.face_value,
      'masked_card_number', v_listing.masked_card_number,
      'gift_card_verification_id', v_listing.verification_id
    ))
  )
  returning id into v_transaction_id;

  update public.listings as target_listing
  set status = 'reserved'
  where target_listing.id = v_listing.id and target_listing.status = 'active';

  if not found then
    raise exception 'Listing could not be reserved' using errcode = '55000';
  end if;

  return query
  select
    v_order_id,
    v_escrow_id,
    v_transaction_id,
    v_listing.id,
    v_listing.seller_id,
    v_listing.asking_price,
    v_listing.currency,
    'pending'::text,
    v_created_at;
end;
$$;

alter function public.purchase_marketplace_listing(uuid) owner to postgres;
revoke all on function public.purchase_marketplace_listing(uuid) from public, anon, authenticated;
grant execute on function public.purchase_marketplace_listing(uuid) to authenticated;