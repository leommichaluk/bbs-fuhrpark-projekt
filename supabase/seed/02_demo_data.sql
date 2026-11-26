-- OPTIONAL: Demo-Daten aus dem UI-Design (14 Fahrzeuge, Termine, Buchungen, Fahrtenbuch, 7 weitere Zugänge).
-- Im Supabase SQL-Editor ausführen, nach den Migrationen und 01_admin.sql. Nur für Entwicklungs-/Testdatenbanken.
-- Vorher unten demo_password setzen (gilt für alle Demo-Zugänge) – das Passwort NICHT committen.
-- Alle Zeiten sind relativ zu heute, damit „läuft heute“, „fällig“ und „überfällig“ immer stimmen.
-- Läuft nur einmal: existiert OS-ST 412 schon, passiert nichts.

-- Hilfsfunktionen, nur für diese Sitzung --------------------------------------------------
create or replace function pg_temp.at(p_day int, p_time time) returns timestamptz
language sql as $$ select ((current_date + p_day) + p_time) at time zone 'Europe/Berlin' $$;
create or replace function pg_temp.fz(p_nr int) returns uuid
language sql as $$ select id from fahrzeuge where kennzeichen = 'OS-ST ' || p_nr $$;
create or replace function pg_temp.u(p_login text) returns uuid
language sql as $$ select id from profiles where email = p_login || '@sensortec-automation.de' $$;

do $$
declare
  demo_password text := 'CHANGE_ME';
  usr record;
  new_id uuid;
begin
  if demo_password = 'CHANGE_ME' then
    raise exception 'Bitte zuerst demo_password in supabase/seed/02_demo_data.sql setzen.';
  end if;
  if pg_temp.fz(412) is not null then
    raise notice 'Demo-Daten existieren bereits – nichts zu tun.';
    return;
  end if;

  -- Zugänge (Profil legt der Trigger handle_new_user an) -----------------------------------
  for usr in select * from (values
    ('m.huelsmann', 'Markus Hülsmann', 'admin', 'Logistik', true),
    ('t.wessels', 'Thomas Wessels', 'mitarbeiter', 'Vertrieb', true),
    ('a.brinkmann', 'Anna Brinkmann', 'mitarbeiter', 'Vertrieb', true),
    ('j.meyer', 'Jonas Meyer', 'mitarbeiter', 'Montage', true),
    ('s.rolfes', 'Sabine Rolfes', 'mitarbeiter', 'Vertrieb', true),
    ('d.kruse', 'Dennis Kruse', 'mitarbeiter', 'Montage', true),
    ('p.lammers', 'Petra Lammers', 'mitarbeiter', 'Einkauf', false)
  ) as t(login, name, rolle, abteilung, aktiv) loop
    if pg_temp.u(usr.login) is null then
      new_id := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
      values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
        usr.login || '@sensortec-automation.de', extensions.crypt(demo_password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('name', usr.name), now(), now(),
        '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), new_id, new_id::text,
        jsonb_build_object('sub', new_id::text, 'email', usr.login || '@sensortec-automation.de', 'email_verified', true),
        'email', now(), now(), now());
    end if;
    update profiles set name = usr.name, rolle = usr.rolle, abteilung = usr.abteilung, aktiv = usr.aktiv
    where id = pg_temp.u(usr.login);
  end loop;

  -- Fahrzeuge ---------------------------------------------------------------------------------
  insert into fahrzeuge (kennzeichen, typ, hersteller, modell, baujahr, kilometerstand, status, pool, status_notiz, kraftstoff, tankkarte) values
    ('OS-ST 118', 'Kleinwagen', 'VW', 'Polo', 2022, 27903, 'verfuegbar', false, null, 'Benzin', null),
    ('OS-ST 139', 'Kleinwagen', 'Seat', 'Ibiza', 2020, 61870, 'verfuegbar', false, null, 'Benzin', null),
    ('OS-ST 152', 'Kombi', 'VW', 'Golf Variant', 2021, 73415, 'verfuegbar', true, null, 'Diesel', null),
    ('OS-ST 184', 'Kombi', 'Opel', 'Astra Sports Tourer', 2017, 141207, 'ausser_betrieb', false,
      'seit ' || to_char(current_date - 42, 'DD.MM.YYYY') || ' · Verkauf geplant', 'Diesel', null),
    ('OS-ST 207', 'Transporter', 'Opel', 'Vivaro', 2019, 112904, 'in_wartung', false,
      'Vertragswerkstatt · seit ' || to_char(current_date - 1, 'DD.MM.'), 'Diesel', null),
    ('OS-ST 226', 'Transporter', 'Ford', 'Transit Custom', 2021, 58761, 'verfuegbar', true, null, 'Diesel', null),
    ('OS-ST 263', 'Kombi', 'Ford', 'Focus Turnier', 2022, 48320, 'verfuegbar', false, null, 'Benzin', null),
    ('OS-ST 271', 'Kombi', 'Skoda', 'Octavia Combi', 2023, 39552, 'verfuegbar', false, null, 'Diesel', null),
    ('OS-ST 298', 'Kombi', 'Skoda', 'Fabia Combi', 2022, 33480, 'verfuegbar', false, null, 'Benzin', null),
    ('OS-ST 316', 'Kombi', 'VW', 'Passat Variant', 2019, 102336, 'verfuegbar', false, null, 'Diesel', null),
    ('OS-ST 355', 'Transporter', 'VW', 'Caddy', 2020, 95118, 'verfuegbar', false, null, 'Diesel', null),
    ('OS-ST 371', 'Kombi', 'Seat', 'Leon ST', 2022, 44019, 'verfuegbar', false, null, 'Benzin', null),
    ('OS-ST 398', 'Kleinwagen', 'VW', 'ID.3', 2023, 18652, 'verfuegbar', true, null, 'Elektro', null),
    ('OS-ST 412', 'Großraumtransporter', 'VW', 'Crafter 35', 2022, 86240, 'verfuegbar', true, null, 'Diesel', '4471');

  -- Termine (überfällig, fällig in ≤ 30 Tagen, in Ordnung) ----------------------------------------
  insert into termine (fahrzeug_id, art, faellig_am) values
    (pg_temp.fz(139), 'Hauptuntersuchung', current_date + 19),
    (pg_temp.fz(207), 'Hauptuntersuchung', current_date - 42),
    (pg_temp.fz(207), 'Inspektion', current_date + 23),
    (pg_temp.fz(355), 'Inspektion', current_date - 13),
    (pg_temp.fz(412), 'Inspektion', current_date + 15),
    (pg_temp.fz(412), 'Hauptuntersuchung', current_date + 170),
    (pg_temp.fz(412), 'UVV-Prüfung', current_date + 111),
    (pg_temp.fz(152), 'Hauptuntersuchung', current_date + 231),
    (pg_temp.fz(226), 'Hauptuntersuchung', current_date + 139);

  -- Wartungshistorie ----------------------------------------------------------------------------
  insert into wartungen (fahrzeug_id, art, datum, kilometerstand, durchgefuehrt_von, beschreibung) values
    (pg_temp.fz(412), 'Inspektion', current_date - 182, 70112, 'Vertragswerkstatt Osnabrück', 'Ölwechsel, Bremsflüssigkeit'),
    (pg_temp.fz(412), 'HU', current_date - 539, 52904, 'Prüfstelle Osnabrück', 'ohne Mängel'),
    (pg_temp.fz(412), 'Reparatur', current_date - 617, 49380, 'Vertragswerkstatt Osnabrück', 'Schiebetür rechts, Führungsschiene erneuert');

  -- Abgeschlossene Fahrten (je Buchung + Fahrtenbucheintrag) -------------------------------------
  with b as (
    insert into buchungen (fahrzeug_id, user_id, von, bis, zweck, status)
    select pg_temp.fz(nr), pg_temp.u(login), pg_temp.at(tag, '08:00'), pg_temp.at(tag, '17:00'), zweck, 'zurueckgegeben'
    from (values
      (412, 't.wessels', -1, 86012, 86240, 'Kundentermin Bramsche'),
      (398, 't.wessels', -4, 18511, 18652, 'Kundentermin Lingen'),
      (412, 'a.brinkmann', -5, 85871, 86012, 'Materiallieferung Lingen'),
      (412, 't.wessels', -7, 85790, 85871, 'Montage Georgsmarienhütte'),
      (152, 't.wessels', -11, 73210, 73415, 'Kundentermin Bielefeld'),
      (412, 'j.meyer', -12, 85402, 85790, 'Messe Hannover'),
      (152, 't.wessels', -19, 72980, 73210, 'Kundentermin Bremen')
    ) as t(nr, login, tag, km_start, km_ende, zweck)
    returning id, fahrzeug_id, user_id, von, bis, zweck
  )
  insert into fahrten (buchung_id, fahrzeug_id, user_id, uebernahme_zeit, uebernahme_km, rueckgabe_zeit, rueckgabe_km, zweck, tank)
  select b.id, b.fahrzeug_id, b.user_id, b.von, t.km_start, b.bis, t.km_ende, b.zweck, 'voll'
  from b join (values
      (412, 't.wessels', -1, 86012, 86240), (398, 't.wessels', -4, 18511, 18652), (412, 'a.brinkmann', -5, 85871, 86012),
      (412, 't.wessels', -7, 85790, 85871), (152, 't.wessels', -11, 73210, 73415), (412, 'j.meyer', -12, 85402, 85790),
      (152, 't.wessels', -19, 72980, 73210)
    ) as t(nr, login, tag, km_start, km_ende)
    on b.fahrzeug_id = pg_temp.fz(t.nr) and b.user_id = pg_temp.u(t.login) and b.von = pg_temp.at(t.tag, '08:00');

  -- Laufende Fahrten (heute übernommen) -------------------------------------------------------------
  with b as (
    insert into buchungen (fahrzeug_id, user_id, von, bis, zweck, status) values
      (pg_temp.fz(412), pg_temp.u('t.wessels'), pg_temp.at(0, '08:00'), pg_temp.at(0, '16:00'), 'Kundentermin Bramsche', 'uebernommen'),
      (pg_temp.fz(263), pg_temp.u('a.brinkmann'), pg_temp.at(0, '08:00'), pg_temp.at(0, '17:00'), 'Kundentermin Osnabrück', 'uebernommen'),
      (pg_temp.fz(271), pg_temp.u('j.meyer'), pg_temp.at(-1, '08:00'), pg_temp.at(2, '17:00'), 'Montage Meppen', 'uebernommen')
    returning id, fahrzeug_id, user_id, von, zweck
  )
  insert into fahrten (buchung_id, fahrzeug_id, user_id, uebernahme_zeit, uebernahme_km, zweck)
  select b.id, b.fahrzeug_id, b.user_id, b.von, f.kilometerstand, b.zweck from b join fahrzeuge f on f.id = b.fahrzeug_id;

  -- Künftige Buchungen ------------------------------------------------------------------------------
  insert into buchungen (fahrzeug_id, user_id, von, bis, zweck) values
    (pg_temp.fz(412), pg_temp.u('j.meyer'), pg_temp.at(1, '08:00'), pg_temp.at(1, '16:00'), 'Montage Lingen'),
    (pg_temp.fz(412), pg_temp.u('a.brinkmann'), pg_temp.at(3, '07:00'), pg_temp.at(3, '18:00'), 'Materialtransport'),
    (pg_temp.fz(226), pg_temp.u('t.wessels'), pg_temp.at(6, '07:30'), pg_temp.at(6, '12:00'), 'Messeaufbau Hannover'),
    (pg_temp.fz(152), pg_temp.u('t.wessels'), pg_temp.at(16, '08:00'), pg_temp.at(16, '17:00'), 'Schulung Münster'),
    (pg_temp.fz(152), pg_temp.u('s.rolfes'), pg_temp.at(8, '08:00'), pg_temp.at(8, '16:00'), 'Kundentermin Münster'),
    (pg_temp.fz(152), pg_temp.u('d.kruse'), pg_temp.at(10, '08:00'), pg_temp.at(10, '16:00'), 'Messe Dortmund'),
    (pg_temp.fz(398), pg_temp.u('t.wessels'), pg_temp.at(1, '09:00'), pg_temp.at(1, '13:00'), 'Ersatzteile abholen Melle');
end $$;
