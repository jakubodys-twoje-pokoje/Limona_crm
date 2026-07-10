-- Checklista nieruchomości (zbieranie informacji + dokumenty do sprzedaży)
-- przenosi się z localStorage do bazy, żeby była cross-platform i widoczna
-- dla centrali (kto odznaczył, kiedy).
alter table properties
  add column if not exists checklist jsonb not null default '{}'::jsonb;

comment on column properties.checklist is
  'Mapa: klucz = treść punktu checklisty, wartość = {checked, checked_by, checked_by_name, checked_at}';
