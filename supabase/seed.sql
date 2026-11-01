-- Seed LOCAL apenas (supabase db reset). A chave abaixo é a chave demo pública do Supabase CLI,
-- igual em toda instalação local; não é segredo. No Cloud, criar os secrets à mão (docs/runbook.md).
select vault.create_secret('http://kong:8000', 'project_url');
select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  'service_role_key'
);
