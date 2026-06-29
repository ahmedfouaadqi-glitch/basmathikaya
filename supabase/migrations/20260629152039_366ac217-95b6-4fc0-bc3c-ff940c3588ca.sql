
alter table public.order_characters add column if not exists visual_brief text;

alter table public.pricing_settings 
  add column if not exists image_quality_tier text not null default 'standard'
    check (image_quality_tier in ('fast','standard','premium')),
  add column if not exists tier_fast_extra_iqd numeric not null default 0,
  add column if not exists tier_premium_extra_iqd numeric not null default 3000;

alter table public.orders add column if not exists image_quality_tier text;

create table if not exists public.story_fingerprints (
  hash text primary key,
  order_id uuid references public.orders(id) on delete cascade,
  plan_seed text not null,
  title text,
  opening text,
  created_at timestamptz not null default now()
);

grant select on public.story_fingerprints to authenticated;
grant all on public.story_fingerprints to service_role;
alter table public.story_fingerprints enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='story_fingerprints' and policyname='service only') then
    create policy "service only" on public.story_fingerprints for all using (false) with check (false);
  end if;
end $$;
