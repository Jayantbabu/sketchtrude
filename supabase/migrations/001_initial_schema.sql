-- SketchTrude initial schema
-- Run in Supabase SQL editor or via supabase db push

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
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
  for each row execute procedure public.handle_new_user();

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled',
  doc_width_mm numeric not null default 420,
  doc_height_mm numeric not null default 297,
  doc_dpi integer not null default 150,
  scale_ratio numeric,
  scale_label text default '1:50',
  metadata jsonb not null default '{}',
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_updated_at_idx on public.projects(updated_at desc);

alter table public.projects enable row level security;

create policy "Users can view own projects"
  on public.projects for select using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete using (auth.uid() = user_id);

-- Layers
create table if not exists public.layers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Layer',
  sort_order integer not null default 0,
  visible boolean not null default true,
  locked boolean not null default false,
  opacity real not null default 1,
  blend_mode text not null default 'source-over',
  trace_tint real not null default 0,
  raster_url text,
  vector_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists layers_project_id_idx on public.layers(project_id);

alter table public.layers enable row level security;

create policy "Users can view own layers"
  on public.layers for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = layers.project_id and p.user_id = auth.uid()
    )
  );

create policy "Users can insert own layers"
  on public.layers for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = layers.project_id and p.user_id = auth.uid()
    )
  );

create policy "Users can update own layers"
  on public.layers for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = layers.project_id and p.user_id = auth.uid()
    )
  );

create policy "Users can delete own layers"
  on public.layers for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = layers.project_id and p.user_id = auth.uid()
    )
  );

-- Exports
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_url text not null,
  file_size_bytes integer,
  created_at timestamptz not null default now()
);

alter table public.exports enable row level security;

create policy "Users can view own exports"
  on public.exports for select using (auth.uid() = user_id);

create policy "Users can insert own exports"
  on public.exports for insert with check (auth.uid() = user_id);

create policy "Users can delete own exports"
  on public.exports for delete using (auth.uid() = user_id);

-- User assets
create table if not exists public.user_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_type text not null check (asset_type in ('stencil', 'brush', 'hatch', 'fill_texture')),
  name text not null,
  file_url text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.user_assets enable row level security;

create policy "Users can manage own assets"
  on public.user_assets for all using (auth.uid() = user_id);

-- Storage buckets (run in Supabase dashboard or via API)
-- insert into storage.buckets (id, name, public) values
--   ('layer-rasters', 'layer-rasters', false),
--   ('exports', 'exports', false),
--   ('thumbnails', 'thumbnails', false),
--   ('user-assets', 'user-assets', false);

-- Storage policies (per-bucket, user-scoped paths: {user_id}/...)
-- create policy "Users upload own layer rasters"
--   on storage.objects for insert
--   with check (bucket_id = 'layer-rasters' and auth.uid()::text = (storage.foldername(name))[1]);

-- create policy "Users read own layer rasters"
--   on storage.objects for select
--   using (bucket_id = 'layer-rasters' and auth.uid()::text = (storage.foldername(name))[1]);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at before update on public.projects
  for each row execute procedure public.set_updated_at();

create trigger layers_updated_at before update on public.layers
  for each row execute procedure public.set_updated_at();
