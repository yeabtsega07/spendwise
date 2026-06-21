-- Spendwise: ADD social features (profiles, loans, split bills).
-- Additive only — does NOT touch your existing transactions table or its data.
-- Run once: Supabase Dashboard -> SQL Editor -> paste -> Run.

-- ============================================================
-- Profiles — a searchable directory of users.
-- Needed so you can lend / split with someone by typing their email.
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

create unique index if not exists profiles_email_idx on public.profiles (lower(email));

alter table public.profiles enable row level security;

-- Any signed-in user can look others up (that's the whole point of a directory).
drop policy if exists "Profiles are searchable" on public.profiles;
create policy "Profiles are searchable"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile"
  on public.profiles for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Mirror new signups into profiles automatically.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this table existed.
insert into public.profiles (id, email, display_name)
select
  id,
  email,
  coalesce(
    raw_user_meta_data->>'name',
    raw_user_meta_data->>'full_name',
    split_part(email, '@', 1)
  )
from auth.users
on conflict (id) do nothing;


-- ============================================================
-- Loans — money lent between two people.
-- The borrower sees the same row on their screen ("you owe …").
-- borrower_id is null for off-platform people (tracked by name only).
-- ============================================================
create table if not exists public.loans (
  id            uuid primary key default gen_random_uuid(),
  lender_id     uuid not null references auth.users (id) on delete cascade,
  lender_name   text not null default '',
  borrower_id   uuid references auth.users (id) on delete set null,
  borrower_name text not null default '',
  amount        numeric not null check (amount > 0),
  currency      text not null,
  note          text not null default '',
  date          date not null default current_date,
  status        text not null default 'active' check (status in ('active', 'settled')),
  created_at    timestamptz not null default now()
);

alter table public.loans enable row level security;

drop policy if exists "Lender or borrower can view loan" on public.loans;
create policy "Lender or borrower can view loan"
  on public.loans for select to authenticated
  using (auth.uid() = lender_id or auth.uid() = borrower_id);

drop policy if exists "Lender creates loan" on public.loans;
create policy "Lender creates loan"
  on public.loans for insert to authenticated
  with check (auth.uid() = lender_id);

-- Either party can flip it to settled / back to active.
drop policy if exists "Lender or borrower updates loan" on public.loans;
create policy "Lender or borrower updates loan"
  on public.loans for update to authenticated
  using (auth.uid() = lender_id or auth.uid() = borrower_id)
  with check (auth.uid() = lender_id or auth.uid() = borrower_id);

drop policy if exists "Lender deletes loan" on public.loans;
create policy "Lender deletes loan"
  on public.loans for delete to authenticated
  using (auth.uid() = lender_id);

create index if not exists loans_lender_idx on public.loans (lender_id, date desc);
create index if not exists loans_borrower_idx on public.loans (borrower_id, date desc);


-- ============================================================
-- Split bills — one payer (creator) splits a bill into shares.
-- Each participant who is a real user sees their share on their screen.
-- ============================================================
create table if not exists public.bills (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  title      text not null default '',
  currency   text not null,
  total      numeric not null check (total > 0),
  date       date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.bill_shares (
  id         uuid primary key default gen_random_uuid(),
  bill_id    uuid not null references public.bills (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete set null,
  name       text not null default '',
  amount     numeric not null check (amount >= 0),
  paid       boolean not null default false,
  is_creator boolean not null default false
);

-- SECURITY DEFINER helpers bypass RLS so the bills <-> bill_shares policies
-- don't reference each other and trigger infinite recursion.
create or replace function public.is_bill_creator(b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.bills where id = b and creator_id = auth.uid());
$$;

create or replace function public.is_bill_participant(b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.bill_shares where bill_id = b and user_id = auth.uid());
$$;

alter table public.bills enable row level security;
alter table public.bill_shares enable row level security;

drop policy if exists "View bills you're part of" on public.bills;
create policy "View bills you're part of"
  on public.bills for select to authenticated
  using (creator_id = auth.uid() or public.is_bill_participant(id));

drop policy if exists "Creator manages bill" on public.bills;
create policy "Creator manages bill"
  on public.bills for all to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

drop policy if exists "View shares of your bills" on public.bill_shares;
create policy "View shares of your bills"
  on public.bill_shares for select to authenticated
  using (public.is_bill_creator(bill_id) or public.is_bill_participant(bill_id));

drop policy if exists "Creator manages shares" on public.bill_shares;
create policy "Creator manages shares"
  on public.bill_shares for all to authenticated
  using (public.is_bill_creator(bill_id)) with check (public.is_bill_creator(bill_id));

-- A participant can update their own share (e.g. mark it paid).
drop policy if exists "Participant updates own share" on public.bill_shares;
create policy "Participant updates own share"
  on public.bill_shares for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists bills_creator_idx on public.bills (creator_id, date desc);
create index if not exists bill_shares_bill_idx on public.bill_shares (bill_id);
create index if not exists bill_shares_user_idx on public.bill_shares (user_id);
