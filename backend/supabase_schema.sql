-- Tickless ads schema (run once in Supabase SQL editor)

create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  slot text not null check (slot in ('leaderboard', 'in_content', 'result')),
  image_url text not null,
  target_url text not null,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_at timestamptz not null default now()
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
