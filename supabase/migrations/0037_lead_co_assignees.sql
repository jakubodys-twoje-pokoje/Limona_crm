-- =============================================================
-- 0037 — dodatkowi opiekunowie leada (co_assignees)
--
-- Lead mógł mieć tylko jednego prowadzącego (assigned_to). Teraz można
-- dołączyć kolejne osoby, które też widzą leada na swojej liście i mogą w
-- nim działać (komentować, rozbić na nieruchomość i klienta) — jak
-- współwykonawcy na zadaniach/nieruchomościach.
--
-- Widoczność egzekwuje API (RLS na leads jest permisywne — patrz 0004):
-- GET /api/leads dokłada warunek co_assignees.ov.{user}.
-- Idempotentna.
-- =============================================================

alter table public.leads add column if not exists co_assignees uuid[] not null default '{}';

-- Szybkie sprawdzenie „czy user jest współopiekunem" przy listowaniu
create index if not exists leads_co_assignees_idx on public.leads using gin (co_assignees);
