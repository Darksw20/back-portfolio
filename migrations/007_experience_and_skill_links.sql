CREATE TABLE project_skills (
  project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill_id bigint NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (project_id, skill_id)
);

CREATE TABLE experiences (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug varchar(128) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  company varchar(160) NOT NULL,
  start_month varchar(7) CHECK (start_month IS NULL OR start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  end_month varchar(7) CHECK (end_month IS NULL OR end_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  website_url text,
  status content_status NOT NULL DEFAULT 'draft',
  development_areas jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(development_areas) = 'array'),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_month IS NULL OR end_month IS NULL OR end_month >= start_month),
  CHECK ((status = 'published' AND published_at IS NOT NULL) OR status <> 'published')
);
CREATE TABLE experience_translations (
  experience_id bigint NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  locale varchar(10) NOT NULL,
  title varchar(180) NOT NULL,
  summary varchar(400) NOT NULL,
  description text NOT NULL,
  PRIMARY KEY (experience_id, locale)
);
CREATE TABLE experience_skills (
  experience_id bigint NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  skill_id bigint NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (experience_id, skill_id)
);
CREATE TRIGGER experiences_set_updated_at BEFORE UPDATE ON experiences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
