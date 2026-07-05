migration plan rough notes:
NEXT_PUBLIC_SUPABASE_URL=<YOUR_SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<YOUR_SUPABASE_PUBLISHABLE_KEY>
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SUPABASE_SERVICE_ROLE_KEY>
SMS_PROVIDER=console


schema:create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references auth.users(id),
  name text not null,
  email text unique not null,
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_at timestamptz default now()
);

create table branches (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  address text,
  created_at timestamptz default now()
);

create table staff (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) unique,
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  email text not null,
  status text not null default 'invited' check (status in ('invited','active','removed')),
  created_at timestamptz default now()
);

create table queues (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade not null,
  branch_id uuid references branches(id),
  name text not null,
  status text not null default 'closed' check (status in ('open','paused','closed')),
  created_at timestamptz default now()
);

create table staff_queue_assignments (
  staff_id uuid references staff(id) on delete cascade,
  queue_id uuid references queues(id) on delete cascade,
  primary key (staff_id, queue_id)
);

create table queue_counters (
  queue_id uuid references queues(id) on delete cascade,
  day date not null default current_date,
  last_token int not null default 0,
  primary key (queue_id, day)
);

create table queue_entries (
  id uuid primary key default uuid_generate_v4(),
  queue_id uuid references queues(id) on delete cascade not null,
  user_id uuid references auth.users(id), -- anonymous-auth session id for the customer
  phone_number text not null,
  customer_name text not null,
  token_number int not null,
  reason_for_visit text, -- staff-facing context
  status text not null default 'waiting' check (status in ('waiting','serving','served','no-show','cancelled')),
  joined_at timestamptz default now(),
  called_at timestamptz,
  served_at timestamptz,
  updated_at timestamptz default now()
);

create unique index unique_active_customer_per_queue
  on queue_entries (phone_number, queue_id) where status = 'waiting';
create index idx_queue_entries_queue_status on queue_entries(queue_id, status);
create index idx_queue_entries_phone on queue_entries(phone_number);

-- Only needed if you run the console/dev SMS provider or a non-Verify vendor.
-- Twilio Verify manages this server-side and makes this table optional.
create table otp_verifications (
  id uuid primary key default uuid_generate_v4(),
  phone_number text not null,
  code_hash text not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz default now()
);
create index idx_otp_phone on otp_verifications(phone_number, created_at desc);

-- Atomic, race-free token numbering
create or replace function next_token_number(p_queue_id uuid)
returns int language plpgsql as $$
declare v_token int;
begin
  insert into queue_counters (queue_id, day, last_token)
  values (p_queue_id, current_date, 1)
  on conflict (queue_id, day)
  do update set last_token = queue_counters.last_token + 1
  returning last_token into v_token;
  return v_token;
end; $$;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger trg_queue_entries_updated_at before update on queue_entries
  for each row execute function set_updated_at();

-- ===== RLS =====
alter table businesses enable row level security;
alter table branches enable row level security;
alter table staff enable row level security;
alter table queues enable row level security;
alter table staff_queue_assignments enable row level security;
alter table queue_entries enable row level security;

-- business_id / role live in app_metadata (server-set only, never user-writable)
create policy admin_full_access on businesses for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy business_owner_reads_own on businesses for select to authenticated
  using (owner_user_id = auth.uid());

create policy business_manages_own_queues on queues for all to authenticated
  using (business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid);

create policy staff_reads_assigned_queues on queues for select to authenticated
  using (exists (
    select 1 from staff_queue_assignments sqa join staff s on s.id = sqa.staff_id
    where sqa.queue_id = queues.id and s.user_id = auth.uid()
  ));

-- true pre-auth public browsing, e.g. scanning the permanent Business QR
create policy public_can_view_open_queues on queues for select to anon
  using (status = 'open' and exists (
    select 1 from businesses b where b.id = queues.business_id and b.status = 'approved'
  ));

create policy business_staff_manage_entries on queue_entries for all to authenticated
  using (exists (
    select 1 from queues q where q.id = queue_entries.queue_id and (
      q.business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
      or exists (
        select 1 from staff_queue_assignments sqa join staff s on s.id = sqa.staff_id
        where sqa.queue_id = q.id and s.user_id = auth.uid()
      )
    )
  ));

-- customer: signed in via Supabase Anonymous Auth after OTP verification
create policy customer_reads_own_entry on queue_entries for select to authenticated
  using (user_id = auth.uid());
create policy customer_inserts_own_entry on queue_entries for insert to authenticated
  with check (user_id = auth.uid());
create policy customer_cancels_own_entry on queue_entries for update to authenticated
  using (user_id = auth.uid()) with check (status = 'cancelled');

  