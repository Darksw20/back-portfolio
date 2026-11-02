ALTER TABLE skills ADD COLUMN icon_url text;
ALTER TABLE skills ADD COLUMN development_areas jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE skills ADD CONSTRAINT skills_development_areas_array CHECK (jsonb_typeof(development_areas) = 'array');
