-- Areas are stored per project with both supported labels; no deployment-specific taxonomy is hard-coded.
ALTER TABLE projects ADD COLUMN development_areas jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD CONSTRAINT projects_development_areas_array CHECK (jsonb_typeof(development_areas) = 'array');
