-- =============================================================
-- 0007 — współrzędne nieruchomości (mapa pokazuje properties + kontakty)
-- Analogicznie do kontakty.lat/lng: geokodowane z properties.location
-- przy tworzeniu/edycji (nieblokująco, Nominatim/OSM).
-- =============================================================

alter table public.properties
  add column lat double precision,
  add column lng double precision;

create index properties_lat_lng_idx on public.properties (lat, lng) where lat is not null;
