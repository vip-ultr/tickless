-- Tickless ads schema (run once in Supabase SQL editor)

create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  slot text not null check (slot in ('leaderboard', 'in_content', 'result')),
  image_url text,
  image_url_mobile text,
  target_url text not null,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_at timestamptz not null default now(),
  -- At least one creative (desktop or mobile) must be present to publish.
  constraint ads_at_least_one_image check (
    image_url is not null or image_url_mobile is not null
  )
);

-- Atomic counter increments used by /impression and /click endpoints
create or replace function increment_ad_counter(ad_id uuid, counter text)
returns void language plpgsql as $$
begin
  if counter = 'impressions' then
    update ads set impressions = impressions + 1 where id = ad_id;
  elsif counter = 'clicks' then
    update ads set clicks = clicks + 1 where id = ad_id;
  end if;
end $$;

-- Storage: create a PUBLIC bucket named 'ad-creatives' in the Supabase dashboard.

-- ---------------------------------------------------------------
-- Site visit analytics (run in Supabase SQL editor after the ads DDL)
-- Privacy: visitor_hash is sha256(ip + UTC-day salt), so raw IPs are
-- never stored and hashes cannot be linked across days.
create table if not exists visits (
  id bigint generated always as identity primary key,
  visitor_hash text not null,
  visit_day date not null default (now() at time zone 'utc')::date,
  hits integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (visitor_hash, visit_day)
);

create index if not exists visits_day_idx on visits (visit_day);

-- One row per visitor per day; repeat loads bump hits.
create or replace function record_visit(p_hash text)
returns void language plpgsql as $$
begin
  insert into visits (visitor_hash)
  values (p_hash)
  on conflict (visitor_hash, visit_day)
  do update set hits = visits.hits + 1, last_seen = now();
end $$;

-- Aggregates for the admin dashboard.
create or replace function visit_stats()
returns json language sql stable as $$
  select json_build_object(
    'today', (select json_build_object(
      'unique_visitors', count(*), 'total_visits', coalesce(sum(hits), 0))
      from visits where visit_day = (now() at time zone 'utc')::date),
    'week', (select json_build_object(
      'unique_visitors', count(distinct visitor_hash), 'total_visits', coalesce(sum(hits), 0))
      from visits where visit_day > (now() at time zone 'utc')::date - 7),
    'month', (select json_build_object(
      'unique_visitors', count(distinct visitor_hash), 'total_visits', coalesce(sum(hits), 0))
      from visits where visit_day > (now() at time zone 'utc')::date - 30),
    'year', (select json_build_object(
      'unique_visitors', count(distinct visitor_hash), 'total_visits', coalesce(sum(hits), 0))
      from visits where visit_day > (now() at time zone 'utc')::date - 365),
    'daily', (select coalesce(json_agg(d order by d.visit_day), '[]'::json) from (
      select visit_day, count(*) as unique_visitors, sum(hits) as total_visits
      from visits
      where visit_day > (now() at time zone 'utc')::date - 30
      group by visit_day
    ) d)
  );
$$;

-- ---------------------------------------------------------------
-- Per-platform download counters (run in Supabase SQL editor)
-- One row per platform+kind+day, bumped by a counter (compact like visits).
create table if not exists downloads (
  id bigint generated always as identity primary key,
  platform text not null,
  kind text not null default 'video',
  day date not null default (now() at time zone 'utc')::date,
  count bigint not null default 1,
  unique (platform, kind, day)
);

create index if not exists downloads_day_idx on downloads (day);

create or replace function record_download(p_platform text, p_kind text)
returns void language plpgsql as $$
begin
  insert into downloads (platform, kind)
  values (p_platform, p_kind)
  on conflict (platform, kind, day)
  do update set count = downloads.count + 1;
end $$;

create or replace function download_stats()
returns json language sql stable as $$
  select coalesce(json_object_agg(p.platform, p.stats), '{}'::json) from (
    select platform, json_build_object(
      'today', (select coalesce(sum(count), 0) from downloads d
                where d.platform = x.platform and day = (now() at time zone 'utc')::date),
      'week', (select coalesce(sum(count), 0) from downloads d
               where d.platform = x.platform and day > (now() at time zone 'utc')::date - 7),
      'month', (select coalesce(sum(count), 0) from downloads d
                where d.platform = x.platform and day > (now() at time zone 'utc')::date - 30),
      'all_time', (select coalesce(sum(count), 0) from downloads d
                   where d.platform = x.platform),
      'video', (select coalesce(sum(count), 0) from downloads d
                where d.platform = x.platform and kind = 'video'),
      'audio', (select coalesce(sum(count), 0) from downloads d
                where d.platform = x.platform and kind = 'audio')
    ) as stats
    from (select distinct platform from downloads) x
  ) p;
$$;
