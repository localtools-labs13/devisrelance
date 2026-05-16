-- Devis Relance secure Supabase schema.
-- Run this in Supabase SQL editor after creating the project.
-- Never expose the service_role key in frontend code.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  phone text,
  requested_plan text default 'gratuit' check (requested_plan in ('gratuit', 'decouverte', 'pro', 'premium')),
  plan text not null default 'gratuit' check (plan in ('gratuit', 'decouverte', 'pro', 'premium')),
  subscription_status text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  project text not null,
  amount numeric(12, 2) default 0,
  status text not null default 'en_cours' check (status in ('en_cours', 'valide', 'perdu')),
  channel text not null default 'email' check (channel in ('email', 'sms', 'humain')),
  next_followup date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_user_id_idx on public.quotes(user_id);
create index if not exists quotes_status_idx on public.quotes(status);
create index if not exists quotes_next_followup_idx on public.quotes(next_followup);

alter table public.profiles enable row level security;
alter table public.quotes enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update safe profile fields" on public.profiles;
create policy "Users can update safe profile fields"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and plan = (select p.plan from public.profiles p where p.id = auth.uid())
  and subscription_status = (select p.subscription_status from public.profiles p where p.id = auth.uid())
  and stripe_customer_id is not distinct from (select p.stripe_customer_id from public.profiles p where p.id = auth.uid())
);

drop policy if exists "Users can read own quotes" on public.quotes;
create policy "Users can read own quotes"
on public.quotes for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own quotes" on public.quotes;
create policy "Users can create own quotes"
on public.quotes for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own quotes" on public.quotes;
create policy "Users can update own quotes"
on public.quotes for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    company,
    phone,
    requested_plan,
    plan,
    subscription_status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'company', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'requested_plan', 'gratuit'),
    'gratuit',
    'free'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Stripe webhook should be handled server-side only.
-- It should update profiles.plan and profiles.subscription_status with the Supabase service_role key
-- stored only in a secure server/edge function, never in frontend files.
