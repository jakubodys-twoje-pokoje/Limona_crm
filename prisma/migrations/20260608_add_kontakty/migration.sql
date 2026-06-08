-- Migration: Add Kontakt and KontaktKomentarz tables
-- Run with: npx prisma migrate deploy

CREATE TABLE "kontakty" (
    "id"                             UUID NOT NULL DEFAULT gen_random_uuid(),
    "typ"                            TEXT NOT NULL,
    "nazwa"                          TEXT NOT NULL,
    "wojewodztwo"                    TEXT,
    "miasto"                         TEXT,
    "ulica"                          TEXT,
    "godziny_otwarcia"               TEXT,
    "telefon"                        TEXT,
    "email"                          TEXT,
    "opis"                           TEXT,
    "assigned_to"                    UUID,
    "oddzial"                        TEXT,
    "created_by"                     UUID,
    "liczba_budynkow"                INTEGER,
    "liczba_mieszkan"                INTEGER,
    "wizyta_osobista"                BOOLEAN NOT NULL DEFAULT false,
    "wyslany_mail_oferta"            BOOLEAN NOT NULL DEFAULT false,
    "zgoda_ulotki"                   BOOLEAN NOT NULL DEFAULT false,
    "zgoda_plakat"                   BOOLEAN NOT NULL DEFAULT false,
    "chec_wspolpracy"                BOOLEAN NOT NULL DEFAULT false,
    "niezainteresowani"              BOOLEAN NOT NULL DEFAULT false,
    "operator_budowy_zainteresowani" BOOLEAN NOT NULL DEFAULT false,
    "ustalona_prowizja"              TEXT,
    "umowa_url"                      TEXT,
    "lat"                            DOUBLE PRECISION,
    "lng"                            DOUBLE PRECISION,
    "created_at"                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"                     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "kontakty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kontakt_komentarze" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "kontakt_id" UUID NOT NULL,
    "user_id"    UUID,
    "content"    TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "kontakt_komentarze_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "kontakty_typ_idx"        ON "kontakty"("typ");
CREATE INDEX "kontakty_assigned_to_idx" ON "kontakty"("assigned_to");
CREATE INDEX "kontakty_created_at_idx" ON "kontakty"("created_at" DESC);
CREATE INDEX "kontakt_komentarze_kontakt_id_idx" ON "kontakt_komentarze"("kontakt_id");
CREATE INDEX "kontakt_komentarze_created_at_idx" ON "kontakt_komentarze"("created_at" DESC);

-- Foreign keys
ALTER TABLE "kontakty" ADD CONSTRAINT "kontakty_assigned_to_fkey"
    FOREIGN KEY ("assigned_to") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kontakty" ADD CONSTRAINT "kontakty_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kontakt_komentarze" ADD CONSTRAINT "kontakt_komentarze_kontakt_id_fkey"
    FOREIGN KEY ("kontakt_id") REFERENCES "kontakty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kontakt_komentarze" ADD CONSTRAINT "kontakt_komentarze_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
