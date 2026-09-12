-- Great British Bake Off Fantasy — schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
--
-- Everything lives in its own "bakeoff" schema so it stays fully isolated
-- from anything else in this Supabase project. After running this, go to
-- Project Settings > API > Data API > "Exposed schemas" and add "bakeoff"
-- (it must be exposed for PostgREST / the JS client to query it).

create extension if not exists pgcrypto;

create schema if not exists bakeoff;

-- ============================================================
-- PROFILES (mirrors auth.users, adds display name + admin flag)
-- ============================================================
create table bakeoff.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- auto-create a profile row whenever someone signs up
create function bakeoff.handle_new_user()
returns trigger as $$
begin
  insert into bakeoff.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = bakeoff, public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure bakeoff.handle_new_user();

-- ============================================================
-- SEASONS
-- ============================================================
create table bakeoff.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CONTESTANTS
-- ============================================================
create table bakeoff.contestants (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references bakeoff.seasons(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- WEEKS  (status: open -> locked -> complete)
-- ============================================================
create table bakeoff.weeks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references bakeoff.seasons(id) on delete cascade,
  week_number int not null,
  label text not null default '',
  status text not null default 'open' check (status in ('open', 'locked', 'complete')),
  created_at timestamptz not null default now(),
  unique (season_id, week_number)
);

-- ============================================================
-- PICKS  (one row per user per week)
-- ============================================================
create table bakeoff.picks (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references bakeoff.weeks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  handshake_guess boolean not null,
  handshake_contestant_id uuid references bakeoff.contestants(id),
  technical_first_id uuid not null references bakeoff.contestants(id),
  technical_last_id uuid not null references bakeoff.contestants(id),
  star_baker_id uuid not null references bakeoff.contestants(id),
  eliminated_id uuid not null references bakeoff.contestants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, user_id),
  constraint handshake_who_requires_yes check (
    (handshake_guess = true) or (handshake_contestant_id is null)
  )
);

-- ============================================================
-- RESULTS  (the admin-submitted answer key, one row per week)
-- ============================================================
create table bakeoff.results (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null unique references bakeoff.weeks(id) on delete cascade,
  handshake_occurred boolean not null,
  handshake_contestant_id uuid references bakeoff.contestants(id),
  technical_first_id uuid not null references bakeoff.contestants(id),
  technical_last_id uuid not null references bakeoff.contestants(id),
  star_baker_id uuid not null references bakeoff.contestants(id),
  eliminated_id uuid not null references bakeoff.contestants(id),
  submitted_at timestamptz not null default now()
);

-- submitting results: mark the week complete + eliminate the contestant
create function bakeoff.apply_results()
returns trigger as $$
begin
  update bakeoff.weeks set status = 'complete' where id = new.week_id;
  update bakeoff.contestants set is_active = false where id = new.eliminated_id;
  return new;
end;
$$ language plpgsql security definer set search_path = bakeoff, public;

create trigger on_results_submitted
  after insert on bakeoff.results
  for each row execute procedure bakeoff.apply_results();

-- ============================================================
-- SCORING VIEWS
-- security_invoker ensures these views enforce RLS as the querying
-- user (anon/authenticated), not as the admin role that created them —
-- without it, Postgres can silently bypass row security through a view.
-- ============================================================

-- per-pick, per-week score breakdown
create view bakeoff.week_scores
with (security_invoker = true) as
select
  p.id as pick_id,
  p.week_id,
  p.user_id,
  w.season_id,
  w.week_number,
  w.label as week_label,
  (case when p.handshake_guess = r.handshake_occurred then 1 else -1 end)
    as handshake_yn_points,
  (case when r.handshake_occurred and p.handshake_guess
        and p.handshake_contestant_id = r.handshake_contestant_id
        then 1 else 0 end) as handshake_who_points,
  (case when p.technical_first_id = r.technical_first_id then 1 else 0 end) as first_points,
  (case when p.technical_last_id = r.technical_last_id then 1 else 0 end) as last_points,
  (case when p.star_baker_id = r.star_baker_id then 1 else 0 end) as star_baker_points,
  (case when p.eliminated_id = r.eliminated_id then 1 else 0 end) as eliminated_points,
  (
    (case when p.handshake_guess = r.handshake_occurred then 1 else -1 end)
    + (case when r.handshake_occurred and p.handshake_guess
            and p.handshake_contestant_id = r.handshake_contestant_id
            then 1 else 0 end)
    + (case when p.technical_first_id = r.technical_first_id then 1 else 0 end)
    + (case when p.technical_last_id = r.technical_last_id then 1 else 0 end)
    + (case when p.star_baker_id = r.star_baker_id then 1 else 0 end)
    + (case when p.eliminated_id = r.eliminated_id then 1 else 0 end)
  ) as total_points
from bakeoff.picks p
join bakeoff.weeks w on w.id = p.week_id
join bakeoff.results r on r.week_id = p.week_id;

-- season leaderboard
create view bakeoff.leaderboard
with (security_invoker = true) as
select
  pr.id as user_id,
  pr.display_name,
  pr.email,
  ws.season_id,
  coalesce(sum(ws.total_points), 0) as total_points,
  count(ws.pick_id) as weeks_scored
from bakeoff.profiles pr
join bakeoff.week_scores ws on ws.user_id = pr.id
group by pr.id, pr.display_name, pr.email, ws.season_id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table bakeoff.profiles enable row level security;
alter table bakeoff.seasons enable row level security;
alter table bakeoff.contestants enable row level security;
alter table bakeoff.weeks enable row level security;
alter table bakeoff.picks enable row level security;
alter table bakeoff.results enable row level security;

-- helper: is the current user an admin?
create function bakeoff.is_admin()
returns boolean as $$
  select coalesce((select is_admin from bakeoff.profiles where id = auth.uid()), false);
$$ language sql security definer stable set search_path = bakeoff, public;

-- profiles: everyone can read (needed for leaderboard names), only self can update own display_name
create policy "profiles readable by all" on bakeoff.profiles for select using (true);
create policy "profiles self update" on bakeoff.profiles for update using (auth.uid() = id);

-- seasons: readable by all logged-in users, writable by admin only
create policy "seasons readable" on bakeoff.seasons for select using (auth.role() = 'authenticated');
create policy "seasons admin write" on bakeoff.seasons for all using (bakeoff.is_admin()) with check (bakeoff.is_admin());

-- contestants: readable by all, writable by admin only
create policy "contestants readable" on bakeoff.contestants for select using (auth.role() = 'authenticated');
create policy "contestants admin write" on bakeoff.contestants for all using (bakeoff.is_admin()) with check (bakeoff.is_admin());

-- weeks: readable by all, writable by admin only
create policy "weeks readable" on bakeoff.weeks for select using (auth.role() = 'authenticated');
create policy "weeks admin write" on bakeoff.weeks for all using (bakeoff.is_admin()) with check (bakeoff.is_admin());

-- results: readable by all (only exist once a week is complete = public answer key), writable by admin only
create policy "results readable" on bakeoff.results for select using (auth.role() = 'authenticated');
create policy "results admin write" on bakeoff.results for all using (bakeoff.is_admin()) with check (bakeoff.is_admin());

-- picks: users always see + manage their own; everyone can see picks once the week is complete
create policy "picks select own or completed week" on bakeoff.picks for select using (
  auth.uid() = user_id
  or exists (select 1 from bakeoff.weeks w where w.id = week_id and w.status = 'complete')
  or bakeoff.is_admin()
);
create policy "picks insert own while open" on bakeoff.picks for insert with check (
  auth.uid() = user_id
  and exists (select 1 from bakeoff.weeks w where w.id = week_id and w.status = 'open')
);
create policy "picks update own while open" on bakeoff.picks for update using (
  auth.uid() = user_id
  and exists (select 1 from bakeoff.weeks w where w.id = week_id and w.status = 'open')
);
create policy "picks delete own while open" on bakeoff.picks for delete using (
  auth.uid() = user_id
  and exists (select 1 from bakeoff.weeks w where w.id = week_id and w.status = 'open')
);

-- ============================================================
-- GRANTS
-- A custom schema has no default privileges — PostgREST calls run as
-- the "anon" or "authenticated" role, so both need USAGE on the schema
-- and table privileges (RLS above still restricts actual row access).
-- ============================================================
grant usage on schema bakeoff to anon, authenticated;

grant select, insert, update, delete on all tables in schema bakeoff to authenticated;
grant select on all tables in schema bakeoff to anon;

alter default privileges in schema bakeoff
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema bakeoff
  grant select on tables to anon;

grant execute on all functions in schema bakeoff to anon, authenticated;
alter default privileges in schema bakeoff
  grant execute on functions to anon, authenticated;

-- ============================================================
-- REALTIME (optional but matches draftpunk pattern — live scoreboard updates)
-- ============================================================
alter publication supabase_realtime add table bakeoff.weeks;
alter publication supabase_realtime add table bakeoff.results;
alter publication supabase_realtime add table bakeoff.picks;
alter publication supabase_realtime add table bakeoff.contestants;

-- ============================================================
-- MAKE YOURSELF ADMIN
-- Run this AFTER you've signed up once through the app's login page:
-- ============================================================
-- update bakeoff.profiles set is_admin = true where email = 'adam.lee.purvis@gmail.com';
