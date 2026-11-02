-- Preserve the original prototype schema before installing the replacement schema.
-- This migration intentionally does not copy plaintext passwords into the new users table.
DO $$
DECLARE
  table_name text;
  archive_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users',
    'contacts',
    'achievements',
    'skills',
    'roles',
    'images',
    'skill_achievements',
    'roles_achievements',
    'images_achievements'
  ]
  LOOP
    archive_name := 'legacy_' || table_name;
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      IF to_regclass('public.' || archive_name) IS NOT NULL THEN
        RAISE EXCEPTION 'Both % and % exist; refusing to overwrite legacy data.', table_name, archive_name;
      END IF;
      EXECUTE format('ALTER TABLE public.%I RENAME TO %I', table_name, archive_name);
    END IF;
  END LOOP;
END;
$$;
