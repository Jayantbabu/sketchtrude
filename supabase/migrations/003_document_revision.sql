-- Optimistic concurrency for project documents
alter table public.projects
  add column if not exists document_revision integer not null default 0;

comment on column public.projects.document_revision is
  'Monotonic revision used for conflict-safe document saves';
