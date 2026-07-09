
-- Lock down storage.objects for the private buckets: story-uploads, story-covers, story-pdfs.
-- All app access to these buckets is server-side via the service role (which bypasses RLS)
-- through signed URLs. No end-user (anon or authenticated) should ever touch these objects
-- directly. Add explicit deny-by-omission policies so access control is verifiable rather
-- than relying on default-deny alone.

-- Drop any legacy policies with these exact names (idempotent re-run).
DROP POLICY IF EXISTS "Deny anon+authenticated read on story-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Deny anon+authenticated write on story-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Deny anon+authenticated update on story-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Deny anon+authenticated delete on story-uploads" ON storage.objects;

DROP POLICY IF EXISTS "Deny anon+authenticated read on story-covers" ON storage.objects;
DROP POLICY IF EXISTS "Deny anon+authenticated write on story-covers" ON storage.objects;
DROP POLICY IF EXISTS "Deny anon+authenticated update on story-covers" ON storage.objects;
DROP POLICY IF EXISTS "Deny anon+authenticated delete on story-covers" ON storage.objects;

DROP POLICY IF EXISTS "Deny anon+authenticated read on story-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Deny anon+authenticated write on story-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Deny anon+authenticated update on story-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Deny anon+authenticated delete on story-pdfs" ON storage.objects;

-- story-uploads: private, server-only via service role.
CREATE POLICY "Deny anon+authenticated read on story-uploads"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (false AND bucket_id = 'story-uploads');
CREATE POLICY "Deny anon+authenticated write on story-uploads"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (false AND bucket_id = 'story-uploads');
CREATE POLICY "Deny anon+authenticated update on story-uploads"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (false AND bucket_id = 'story-uploads')
  WITH CHECK (false AND bucket_id = 'story-uploads');
CREATE POLICY "Deny anon+authenticated delete on story-uploads"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (false AND bucket_id = 'story-uploads');

-- story-covers: private, server-only via service role.
CREATE POLICY "Deny anon+authenticated read on story-covers"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (false AND bucket_id = 'story-covers');
CREATE POLICY "Deny anon+authenticated write on story-covers"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (false AND bucket_id = 'story-covers');
CREATE POLICY "Deny anon+authenticated update on story-covers"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (false AND bucket_id = 'story-covers')
  WITH CHECK (false AND bucket_id = 'story-covers');
CREATE POLICY "Deny anon+authenticated delete on story-covers"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (false AND bucket_id = 'story-covers');

-- story-pdfs: private, server-only via service role.
CREATE POLICY "Deny anon+authenticated read on story-pdfs"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (false AND bucket_id = 'story-pdfs');
CREATE POLICY "Deny anon+authenticated write on story-pdfs"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (false AND bucket_id = 'story-pdfs');
CREATE POLICY "Deny anon+authenticated update on story-pdfs"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (false AND bucket_id = 'story-pdfs')
  WITH CHECK (false AND bucket_id = 'story-pdfs');
CREATE POLICY "Deny anon+authenticated delete on story-pdfs"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (false AND bucket_id = 'story-pdfs');
