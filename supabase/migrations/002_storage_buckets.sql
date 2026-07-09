-- Storage buckets and RLS policies
-- Run after 001_initial_schema.sql in Supabase SQL editor

insert into storage.buckets (id, name, public)
values
  ('layer-rasters', 'layer-rasters', false),
  ('exports', 'exports', false),
  ('thumbnails', 'thumbnails', false),
  ('user-assets', 'user-assets', false)
on conflict (id) do nothing;

-- Helper: path format is {user_id}/{project_id}/{filename}

create policy "Users upload own files"
  on storage.objects for insert
  with check (
    auth.uid()::text = (storage.foldername(name))[1]
    and bucket_id in ('layer-rasters', 'exports', 'thumbnails', 'user-assets')
  );

create policy "Users read own files"
  on storage.objects for select
  using (
    auth.uid()::text = (storage.foldername(name))[1]
    and bucket_id in ('layer-rasters', 'exports', 'thumbnails', 'user-assets')
  );

create policy "Users update own files"
  on storage.objects for update
  using (
    auth.uid()::text = (storage.foldername(name))[1]
    and bucket_id in ('layer-rasters', 'exports', 'thumbnails', 'user-assets')
  );

create policy "Users delete own files"
  on storage.objects for delete
  using (
    auth.uid()::text = (storage.foldername(name))[1]
    and bucket_id in ('layer-rasters', 'exports', 'thumbnails', 'user-assets')
  );
