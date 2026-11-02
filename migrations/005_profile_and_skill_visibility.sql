ALTER TABLE skills ALTER COLUMN proficiency DROP NOT NULL;
ALTER TABLE profile_translations ADD COLUMN work_history text NOT NULL DEFAULT '';
