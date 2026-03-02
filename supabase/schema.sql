-- ============================================================
-- HOME BASE — Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- ============================================================
-- HOUSEHOLDS
-- ============================================================
create table if not exists households (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  inbound_email_token   text unique default encode(gen_random_bytes(12), 'hex'),
  created_at            timestamptz default now()
);

-- ============================================================
-- PROFILES  (one row per auth.users row)
-- ============================================================
create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  household_id  uuid references households on delete set null,
  display_name  text not null,
  created_at    timestamptz default now()
);

-- Auto-create a profile on sign-up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- BUDGET GROUPS  (50 / 30 / 20 buckets)
-- ============================================================
create table if not exists budget_groups (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  name          text not null,
  target_pct    numeric(5,2),
  sort_order    int default 0,
  created_at    timestamptz default now()
);

-- ============================================================
-- BUDGET CATEGORIES
-- ============================================================
create table if not exists budget_categories (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references households on delete cascade,
  group_id              uuid references budget_groups on delete set null,
  name                  text not null,
  owner                 text check (owner in ('joint', 'shaun', 'rosie')),
  is_savings            boolean default false,
  is_personal_allowance boolean default false,
  sort_order            int default 0,
  created_at            timestamptz default now()
);

-- ============================================================
-- BUDGET ITEMS  (versioned amounts per category)
-- ============================================================
create table if not exists budget_items (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households on delete cascade,
  category_id         uuid not null references budget_categories on delete cascade,
  amount              numeric(10,2) not null,
  frequency           text not null check (
                        frequency in ('weekly','fortnightly','monthly','quarterly','annual')
                      ),
  monthly_equivalent  numeric(10,2) not null,
  effective_from      date not null default date_trunc('month', current_date)::date,
  effective_to        date,
  created_at          timestamptz default now()
);

-- ============================================================
-- SAVINGS GOALS
-- ============================================================
create table if not exists savings_goals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  category_id   uuid references budget_categories on delete set null,
  name          text not null,
  target_amount numeric(10,2),
  is_flexi      boolean default false,
  sort_order    int default 0,
  created_at    timestamptz default now()
);

-- ============================================================
-- RECURRING BILLS
-- ============================================================
create table if not exists bills (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households on delete cascade,
  category_id         uuid references budget_categories on delete set null,
  name                text not null,
  amount              numeric(10,2),
  frequency           text check (
                        frequency in ('weekly','fortnightly','monthly','quarterly','annual')
                      ),
  next_due_date       date,
  last_paid_date      date,
  is_paid             boolean default false,
  source              text check (source in ('manual','email','detected')),
  notify_days_before  int default 3,
  created_at          timestamptz default now()
);

-- ============================================================
-- IMPORT BATCHES  (CSV uploads)
-- ============================================================
create table if not exists import_batches (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  bank          text not null check (bank in ('ANZ','BNZ')),
  file_name     text,
  file_hash     text not null,
  row_count     int,
  status        text check (status in ('pending','complete','skipped')),
  created_at    timestamptz default now()
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table if not exists transactions (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households on delete cascade,
  import_batch_id   uuid references import_batches on delete set null,
  date              date not null,
  amount            numeric(10,2) not null,
  description       text,
  payee             text,
  memo              text,
  bank              text,
  account           text,
  category_id       uuid references budget_categories on delete set null,
  categorised_by    text check (categorised_by in ('claude','user','rule')),
  is_transfer       boolean default false,
  raw_data          jsonb,
  created_at        timestamptz default now()
);

-- ============================================================
-- INBOUND EMAILS  (bill forwarding)
-- ============================================================
create table if not exists inbound_emails (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households on delete cascade,
  from_address    text,
  subject         text,
  received_at     timestamptz,
  raw_html        text,
  parsed_amount   numeric(10,2),
  parsed_due_date date,
  parsed_biller   text,
  bill_id         uuid references bills on delete set null,
  status          text check (status in ('processed','unmatched','error')),
  created_at      timestamptz default now()
);

-- ============================================================
-- PUSH SUBSCRIPTIONS  (Web Push / PWA)
-- ============================================================
create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  profile_id    uuid not null references profiles on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz default now()
);

-- ============================================================
-- NOTIFICATIONS  (in-app)
-- ============================================================
create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  profile_id    uuid not null references profiles on delete cascade,
  type          text check (type in (
                  'bill_due',
                  'budget_exceeded',
                  'category_suggestion',
                  'import_complete'
                )),
  title         text not null,
  body          text,
  payload       jsonb,
  read_at       timestamptz,
  created_at    timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table households          enable row level security;
alter table profiles            enable row level security;
alter table budget_groups       enable row level security;
alter table budget_categories   enable row level security;
alter table budget_items        enable row level security;
alter table savings_goals       enable row level security;
alter table bills               enable row level security;
alter table import_batches      enable row level security;
alter table transactions        enable row level security;
alter table inbound_emails      enable row level security;
alter table push_subscriptions  enable row level security;
alter table notifications       enable row level security;

-- Helper: returns the caller's household_id (used in all RLS policies)
create or replace function my_household_id()
returns uuid language sql security definer stable as $$
  select household_id from profiles where id = auth.uid()
$$;

-- profiles: users can read/update their own row only
create policy "own profile" on profiles
  for all using (id = auth.uid());

-- households: members can read their own household
create policy "own household" on households
  for all using (id = my_household_id());

-- everything else: scoped to household
create policy "household members only" on budget_groups
  for all using (household_id = my_household_id());

create policy "household members only" on budget_categories
  for all using (household_id = my_household_id());

create policy "household members only" on budget_items
  for all using (household_id = my_household_id());

create policy "household members only" on savings_goals
  for all using (household_id = my_household_id());

create policy "household members only" on bills
  for all using (household_id = my_household_id());

create policy "household members only" on import_batches
  for all using (household_id = my_household_id());

create policy "household members only" on transactions
  for all using (household_id = my_household_id());

create policy "household members only" on inbound_emails
  for all using (household_id = my_household_id());

create policy "household members only" on push_subscriptions
  for all using (household_id = my_household_id());

create policy "household members only" on notifications
  for all using (household_id = my_household_id());

-- ============================================================
-- INDEXES  (query performance)
-- ============================================================
create index if not exists transactions_household_date on transactions (household_id, date desc);
create index if not exists transactions_category on transactions (category_id);
create index if not exists bills_household_due on bills (household_id, next_due_date);
create index if not exists notifications_profile_unread on notifications (profile_id, read_at) where read_at is null;
