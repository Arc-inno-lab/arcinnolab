-- Policy temporaire pour permettre l'upload initial des assets de marque statiques (logos,
-- visuel d'accueil) depuis un script one-off avec la clé anon, sans passer par une session
-- utilisateur. Supprimée juste après l'upload (voir migration 009).
create policy arcinnolab_media_temp_anon_insert on storage.objects
  for insert to anon
  with check (bucket_id = 'arcinnolab-media');
