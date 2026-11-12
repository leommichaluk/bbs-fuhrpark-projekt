-- Schema an das UI-Design anpassen. Läuft nach migration.md, im Supabase SQL-Editor ausführen.
-- Idempotent: kann mehrfach ausgeführt werden.

-- Fahrzeuggrößen aus dem Design statt der alten Typen --------------------------
alter table fahrzeuge drop constraint if exists fahrzeuge_typ_check;
update fahrzeuge set typ = 'Kombi' where typ in ('Außendienstfahrzeug', 'Sonstiges');
alter table fahrzeuge add constraint fahrzeuge_typ_check
  check (typ in ('Kleinwagen', 'Kombi', 'Transporter', 'Großraumtransporter'));

-- Felder, die das Design zeigt -----------------------------------------------------
alter table fahrzeuge add column if not exists status_notiz text;   -- z. B. „seit 01.09.2026 · Verkauf geplant“
alter table fahrzeuge add column if not exists kraftstoff text;
alter table fahrzeuge add column if not exists tankkarte text;      -- nur die letzten 4 Ziffern
alter table profiles add column if not exists abteilung text not null default '';
alter table fahrten add column if not exists tank text;             -- Tankfüllung bei Rückgabe: leer, ¼, ½, ¾, voll
alter table fahrten add column if not exists hinweis text;
alter table wartungen add column if not exists durchgefuehrt_von text not null default '';

-- Termin- und Wartungsarten aus dem Design --------------------------------------------
alter table termine drop constraint if exists termine_art_check;
alter table termine add constraint termine_art_check
  check (art in ('Hauptuntersuchung', 'Inspektion', 'UVV-Prüfung', 'Wartung'));
alter table wartungen drop constraint if exists wartungen_art_check;
alter table wartungen add constraint wartungen_art_check
  check (art in ('HU', 'Inspektion', 'Wartung', 'Reparatur', 'Werkstattaufenthalt'));

-- Rückgabe speichert jetzt auch Tankfüllung und Hinweis -------------------------------
drop function if exists fahrzeug_zurueckgeben(uuid, int);
create or replace function fahrzeug_zurueckgeben(p_buchung uuid, p_km int, p_tank text default null, p_hinweis text default null) returns void
language plpgsql security definer set search_path = public as $$
declare b buchungen;
begin
  select * into b from buchungen where id = p_buchung and user_id = auth.uid() and status = 'uebernommen';
  if not found then raise exception 'Buchung nicht gefunden oder nicht übernommen.'; end if;
  update fahrten set rueckgabe_zeit = now(), rueckgabe_km = p_km, tank = p_tank, hinweis = p_hinweis where buchung_id = b.id;
  update fahrzeuge set kilometerstand = p_km where id = b.fahrzeug_id;
  update buchungen set status = 'zurueckgegeben' where id = b.id;
end $$;
revoke execute on function fahrzeug_zurueckgeben from public, anon;
grant execute on function fahrzeug_zurueckgeben to authenticated;

-- Ohne Login darf nichts lesbar sein: alle Policies für die Rolle anon entfernen ---------
-- (z. B. die „anon read“-Policy aus der README, die bisher fahrzeuge öffentlich macht)
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' and 'anon' = any(roles) loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;
