create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin', 'support', 'compliance', 'operations')),
  phone text,
  country text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'pending', 'disabled', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    status,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'customer',
    'active',
    now(),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = role_name
  );
$$;

alter table public.profiles enable row level security;

create policy "Profiles can be read by owner or privileged staff"
on public.profiles
for select
using (
  id = auth.uid()
  or public.has_role('admin')
  or public.has_role('support')
  or public.has_role('compliance')
  or public.has_role('operations')
);

create policy "Profiles cannot be directly inserted by clients"
on public.profiles
for insert
with check (false);

create policy "Users can update only their own profile fields"
on public.profiles
for update
using (id = auth.uid())
with check (
  id = auth.uid()
  and email = (select p.email from public.profiles p where p.id = auth.uid())
  and role = (select p.role from public.profiles p where p.id = auth.uid())
  and status = (select p.status from public.profiles p where p.id = auth.uid())
  and created_at = (select p.created_at from public.profiles p where p.id = auth.uid())
);

create policy "Privileged staff can manage profile records"
on public.profiles
for update
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

create policy "Profiles cannot be deleted by clients"
on public.profiles
for delete
using (false);
