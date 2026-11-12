-- Fuhrparkverwaltung: Schema + Row Level Security
-- Im Supabase SQL-Editor ausführen.
-- Ersten Admin anlegen: nach der Registrierung
--   update profiles set rolle = 'admin' where email = 'deine@mail.de';

create extension if not exists btree_gist;

-- Benutzer ---------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text not null default '',
  rolle text not null default 'mitarbeiter' check (rolle in ('admin', 'mitarbeiter')),
  aktiv boolean not null default true
);

create function is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where id = auth.uid() and rolle = 'admin' and aktiv)
$$;

create function is_aktiv() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where id = auth.uid() and aktiv)
$$;

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Fahrzeuge ----------------------------------------------------------------
create table fahrzeuge (
  id uuid primary key default gen_random_uuid(),
  kennzeichen text not null,
  typ text not null check (typ in ('Transporter', 'Kleinwagen', 'Außendienstfahrzeug', 'Sonstiges')),
  hersteller text not null,
  modell text not null,
  baujahr int not null check (baujahr between 1950 and 2100),
  kilometerstand int not null check (kilometerstand >= 0),
  status text not null default 'verfuegbar' check (status in ('verfuegbar', 'in_wartung', 'ausser_betrieb')),
  pool boolean not null default true,
  zugeordnet_an uuid references profiles on delete set null
);
create unique index fahrzeuge_kennzeichen_uq on fahrzeuge (upper(replace(kennzeichen, ' ', '')));

-- Wartungen / Reparaturen / Werkstatt -----------------------------------------
create table wartungen (
  id uuid primary key default gen_random_uuid(),
  fahrzeug_id uuid not null references fahrzeuge on delete cascade,
  art text not null check (art in ('Wartung', 'Reparatur', 'Werkstattaufenthalt')),
  datum date not null,
  kilometerstand int not null check (kilometerstand >= 0),
  beschreibung text not null default '',
  kosten numeric(10, 2) check (kosten >= 0)
);

-- Termine (HU, Inspektion, Wartung) -------------------------------------------
create table termine (
  id uuid primary key default gen_random_uuid(),
  fahrzeug_id uuid not null references fahrzeuge on delete cascade,
  art text not null check (art in ('Hauptuntersuchung', 'Inspektion', 'Wartung')),
  faellig_am date not null,
  erledigt boolean not null default false
);

-- Buchungen ---------------------------------------------------------------------
create table buchungen (
  id uuid primary key default gen_random_uuid(),
  fahrzeug_id uuid not null references fahrzeuge on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  von timestamptz not null,
  bis timestamptz not null,
  zweck text not null default '',
  status text not null default 'gebucht' check (status in ('gebucht', 'uebernommen', 'zurueckgegeben', 'storniert')),
  check (bis > von),
  -- keine Überschneidung pro Fahrzeug
  exclude using gist (fahrzeug_id with =, tstzrange(von, bis) with &&) where (status <> 'storniert')
);

-- Fahrtenbuch -------------------------------------------------------------------
create table fahrten (
  id uuid primary key default gen_random_uuid(),
  buchung_id uuid not null unique references buchungen on delete cascade,
  fahrzeug_id uuid not null references fahrzeuge on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  uebernahme_zeit timestamptz not null default now(),
  uebernahme_km int not null check (uebernahme_km >= 0),
  rueckgabe_zeit timestamptz,
  rueckgabe_km int,
  zweck text not null,
  check (rueckgabe_km is null or rueckgabe_km >= uebernahme_km)
);

-- Tankungen ---------------------------------------------------------------------
create table tankungen (
  id uuid primary key default gen_random_uuid(),
  fahrzeug_id uuid not null references fahrzeuge on delete cascade,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  datum date not null default current_date,
  liter numeric(6, 2) not null check (liter > 0),
  kosten numeric(10, 2) not null check (kosten >= 0),
  kilometerstand int not null check (kilometerstand >= 0)
);

-- Kilometerstand darf nie sinken -----------------------------------------------
create function km_nicht_sinken() returns trigger
language plpgsql as $$
begin
  if new.kilometerstand < old.kilometerstand then
    raise exception 'Der Kilometerstand darf nicht sinken (aktuell %).', old.kilometerstand;
  end if;
  return new;
end $$;
create trigger fahrzeuge_km before update on fahrzeuge
  for each row execute function km_nicht_sinken();

-- Übernahme / Rückgabe (einzige Schreibwege für Mitarbeiter ins Fahrtenbuch) ---
create function fahrzeug_uebernehmen(p_buchung uuid, p_km int, p_zweck text) returns void
language plpgsql security definer set search_path = public as $$
declare b buchungen; f fahrzeuge;
begin
  select * into b from buchungen where id = p_buchung and user_id = auth.uid() and status = 'gebucht';
  if not found then raise exception 'Buchung nicht gefunden oder nicht übernehmbar.'; end if;
  if now() < b.von or now() > b.bis then raise exception 'Außerhalb des Buchungszeitraums.'; end if;
  select * into f from fahrzeuge where id = b.fahrzeug_id;
  if f.status <> 'verfuegbar' then raise exception 'Fahrzeug ist nicht verfügbar.'; end if;
  if p_km < f.kilometerstand then raise exception 'Kilometerstand darf nicht unter % liegen.', f.kilometerstand; end if;
  insert into fahrten (buchung_id, fahrzeug_id, user_id, uebernahme_km, zweck)
  values (b.id, b.fahrzeug_id, b.user_id, p_km, p_zweck);
  update fahrzeuge set kilometerstand = p_km where id = b.fahrzeug_id;
  update buchungen set status = 'uebernommen' where id = b.id;
end $$;

create function fahrzeug_zurueckgeben(p_buchung uuid, p_km int) returns void
language plpgsql security definer set search_path = public as $$
declare b buchungen;
begin
  select * into b from buchungen where id = p_buchung and user_id = auth.uid() and status = 'uebernommen';
  if not found then raise exception 'Buchung nicht gefunden oder nicht übernommen.'; end if;
  update fahrten set rueckgabe_zeit = now(), rueckgabe_km = p_km where buchung_id = b.id;
  update fahrzeuge set kilometerstand = p_km where id = b.fahrzeug_id;
  update buchungen set status = 'zurueckgegeben' where id = b.id;
end $$;

-- Row Level Security --------------------------------------------------------------
alter table profiles enable row level security;
alter table fahrzeuge enable row level security;
alter table wartungen enable row level security;
alter table termine enable row level security;
alter table buchungen enable row level security;
alter table fahrten enable row level security;
alter table tankungen enable row level security;

-- Profile: eigenes lesen, Admin alles; nur Admin ändert (Rolle/aktiv)
create policy profiles_select on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_admin_update on profiles for update using (is_admin()) with check (is_admin());

-- Fahrzeuge, Wartungen, Termine: alle Aktiven lesen, nur Admin schreibt
create policy fahrzeuge_select on fahrzeuge for select using (is_aktiv());
create policy fahrzeuge_admin on fahrzeuge for all using (is_admin()) with check (is_admin());
create policy wartungen_select on wartungen for select using (is_aktiv());
create policy wartungen_admin on wartungen for all using (is_admin()) with check (is_admin());
create policy termine_select on termine for select using (is_aktiv());
create policy termine_admin on termine for all using (is_admin()) with check (is_admin());

-- Buchungen: alle Aktiven sehen Zeiträume (Verfügbarkeit); buchen nur Poolfahrzeuge im eigenen Namen
create policy buchungen_select on buchungen for select using (is_aktiv());
create policy buchungen_insert on buchungen for insert with check (
  is_aktiv() and user_id = auth.uid() and status = 'gebucht'
  and exists (select 1 from fahrzeuge f where f.id = fahrzeug_id and f.pool and f.status <> 'ausser_betrieb')
);
-- Mitarbeiter dürfen nur stornieren; Übernahme/Rückgabe laufen über die Funktionen
create policy buchungen_cancel on buchungen for update
  using (user_id = auth.uid() and status = 'gebucht') with check (user_id = auth.uid() and status = 'storniert');
create policy buchungen_admin on buchungen for all using (is_admin()) with check (is_admin());

-- Fahrtenbuch: eigene Einträge lesen, Admin alles
create policy fahrten_select on fahrten for select using (user_id = auth.uid() or is_admin());
create policy fahrten_admin on fahrten for all using (is_admin()) with check (is_admin());

-- Tankungen: eigene lesen/anlegen, Admin alles
create policy tankungen_select on tankungen for select using (user_id = auth.uid() or is_admin());
create policy tankungen_insert on tankungen for insert with check (is_aktiv() and user_id = auth.uid());
create policy tankungen_admin on tankungen for all using (is_admin()) with check (is_admin());

revoke execute on function fahrzeug_uebernehmen, fahrzeug_zurueckgeben from public, anon;
grant execute on function fahrzeug_uebernehmen, fahrzeug_zurueckgeben to authenticated;
