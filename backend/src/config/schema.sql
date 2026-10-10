-- Applied on every startup; each statement is idempotent.
-- Row level security is on with no policies: only the backend's database role (which bypasses RLS)
-- can read or write, so Supabase's public Data API exposes nothing with the anon key.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Unique but nullable: wallet-only users may have no email.
  email text unique,
  auth_provider text not null default 'local'
    check (auth_provider in ('local', 'google', 'apple', 'email_passwordless', 'discord', 'wallet')),
  google_id text,
  apple_id text,
  password text,
  wallet_address text unique,
  avatar text,
  reset_password_token text,
  reset_password_expires timestamptz,
  reminders_enabled boolean not null default true,
  reminder_minutes integer not null default 15 check (reminder_minutes in (5, 15, 30, 60)),
  -- null = keep until the user deletes them.
  retention_days integer check (retention_days in (30, 90, 365)),
  allow_recording boolean not null default true,
  created_at timestamptz not null default now(),
  check (auth_provider <> 'local' or password is not null)
);
create index if not exists users_google_id_idx on users (google_id);
create index if not exists users_apple_id_idx on users (apple_id);

create table if not exists meeting_rooms (
  room_code text primary key,
  host_user_id uuid not null references users (id) on delete cascade,
  host_name text not null,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meeting_rooms_host_idx on meeting_rooms (host_user_id);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  address text not null,
  sender_id uuid references users (id) on delete set null,
  message text not null check (char_length(message) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_messages_room_idx on chat_messages (room_code, created_at);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  rating integer check (rating between 1 and 5),
  room_code text,
  submitted_by uuid references users (id) on delete set null,
  text text not null check (char_length(text) <= 2000),
  created_at timestamptz not null default now()
);

create table if not exists meeting_agendas (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  -- [{ _id, title, completed }]
  topics jsonb not null default '[]',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists meeting_sessions (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  host uuid references users (id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  -- [{ user, name, seconds }]
  participants jsonb not null default '[]',
  counts jsonb not null default '{}'
);
create index if not exists meeting_sessions_host_idx on meeting_sessions (host);
create index if not exists meeting_sessions_participants_idx on meeting_sessions using gin (participants jsonb_path_ops);

create table if not exists recordings (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  uploaded_by uuid not null references users (id) on delete cascade,
  filename text not null,
  original_name text not null default '',
  size bigint not null default 0,
  duration double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists recordings_owner_idx on recordings (uploaded_by, created_at);

create table if not exists scheduled_meetings (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references users (id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  start_at timestamptz not null,
  -- minutes; matches the scheduler form
  duration integer not null check (duration between 5 and 480),
  recurring text not null default 'none' check (recurring in ('none', 'daily', 'weekly')),
  participants text[] not null default '{}',
  -- Registered meeting room; the scheduler owns the room and is its host.
  room_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scheduled_meetings_owner_idx on scheduled_meetings (owner, start_at);

alter table users enable row level security;
alter table meeting_rooms enable row level security;
alter table chat_messages enable row level security;
alter table feedback enable row level security;
alter table meeting_agendas enable row level security;
alter table meeting_sessions enable row level security;
alter table recordings enable row level security;
alter table scheduled_meetings enable row level security;
