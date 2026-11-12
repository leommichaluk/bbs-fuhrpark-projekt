-- Ersten Admin-Zugang anlegen. Im Supabase SQL-Editor ausführen, nach den Migrationen.
-- Vorher unten E-Mail und Passwort setzen – das Passwort NICHT committen.
-- Idempotent: existiert die Adresse schon, wird sie nur zum aktiven Admin gemacht.

do $$
declare
  admin_email text := 'k.albers@sensortec-automation.de';
  admin_name text := 'Katrin Albers';
  admin_password text := 'CHANGE_ME';
  admin_id uuid;
begin
  if admin_password = 'CHANGE_ME' then
    raise exception 'Bitte zuerst admin_password in supabase/seed/01_admin.sql setzen.';
  end if;

  select id into admin_id from auth.users where email = admin_email;
  if admin_id is null then
    admin_id := gen_random_uuid();
    -- Leere Token-Spalten statt NULL, sonst schlägt die Anmeldung bei GoTrue fehl
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', admin_email,
      extensions.crypt(admin_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('name', admin_name), now(), now(),
      '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), admin_id, admin_id::text,
      jsonb_build_object('sub', admin_id::text, 'email', admin_email, 'email_verified', true), 'email', now(), now(), now());
  end if;

  -- Das Profil legt der Trigger handle_new_user an
  update profiles set rolle = 'admin', aktiv = true, name = admin_name, abteilung = 'Logistik' where id = admin_id;
end $$;
