-- FILO - BACHECA CLOUD PUBBLICA, SENZA LOGIN
-- AVVERTENZA: ogni visitatore, anche senza credenziali, puo' leggere,
-- modificare ed eliminare TUTTE le attivita' e gli allegati di questa bacheca.
-- E' una scelta esplicita per il funzionamento senza autenticazione.
-- Non usare per dati personali, aziendali, riservati o protetti.
-- Eseguire nel SQL Editor del proprio progetto Supabase.

create table if not exists public.filo_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '',
  due_date date,
  project text not null default '',
  status text not null default 'todo' check (status in ('todo','doing','done')),
  notes jsonb not null default '[]'::jsonb check (jsonb_typeof(notes)='array'),
  subtasks jsonb not null default '[]'::jsonb check (jsonb_typeof(subtasks)='array'),
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments)='array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists filo_tasks_due_idx on public.filo_tasks(due_date);

-- RLS e autorizzazioni PER ACCESSO PUBBLICO (ruolo anon).
alter table public.filo_tasks enable row level security;
revoke all on public.filo_tasks from anon, authenticated;
grant usage on schema public to anon;
grant select, insert, update, delete on public.filo_tasks to anon;

drop policy if exists filo_anon_read on public.filo_tasks;
create policy filo_anon_read on public.filo_tasks for select to anon using (true);
drop policy if exists filo_anon_create on public.filo_tasks;
create policy filo_anon_create on public.filo_tasks for insert to anon with check (true);
drop policy if exists filo_anon_edit on public.filo_tasks;
create policy filo_anon_edit on public.filo_tasks for update to anon using (true) with check (true);
drop policy if exists filo_anon_delete on public.filo_tasks;
create policy filo_anon_delete on public.filo_tasks for delete to anon using (true);

-- Bucket PUBBLICO. Ogni persona puo' leggere i file conoscendone il link;
-- con l'API pubblica puo' anche caricare e cancellare file in questo bucket.
insert into storage.buckets (id,name,public,file_size_limit)
values ('filo-files','filo-files',true,20971520)
on conflict (id) do update set public=true,file_size_limit=20971520;

drop policy if exists filo_anon_file_read on storage.objects;
create policy filo_anon_file_read on storage.objects
for select to anon using (bucket_id='filo-files');

drop policy if exists filo_anon_file_upload on storage.objects;
create policy filo_anon_file_upload on storage.objects
for insert to anon with check (bucket_id='filo-files');

drop policy if exists filo_anon_file_delete on storage.objects;
create policy filo_anon_file_delete on storage.objects
for delete to anon using (bucket_id='filo-files');

-- Non abilitare un service_role o un token segreto nel frontend.
-- Consigliato: quote/limiti nel progetto, backup periodici e valutare in futuro
-- un backend autenticato se si devono archiviare informazioni riservate.
