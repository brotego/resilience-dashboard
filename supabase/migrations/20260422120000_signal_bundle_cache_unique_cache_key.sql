-- One row per cache_key: lets client upsert(onConflict: 'cache_key') update in place instead of inserting duplicates.
-- Run via Supabase CLI or SQL editor after `signal_bundle_cache` exists.

begin;

delete from public.signal_bundle_cache dup
where dup.ctid in (
  select ctid from (
    select
      ctid,
      row_number() over (
        partition by cache_key
        order by saved_at desc nulls last
      ) as rn
    from public.signal_bundle_cache
  ) ranked
  where ranked.rn > 1
);

create unique index if not exists signal_bundle_cache_cache_key_uidx
  on public.signal_bundle_cache (cache_key);

commit;
