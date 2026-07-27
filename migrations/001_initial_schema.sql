CREATE TYPE content_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE account_role AS ENUM ('superuser', 'editor');
CREATE TYPE skill_group AS ENUM ('soft_skill', 'programming_language', 'tool', 'spoken_language');
CREATE TYPE learning_type AS ENUM ('course', 'certification', 'degree');
CREATE TYPE contact_status AS ENUM ('new', 'approved', 'rejected', 'replied');

CREATE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email varchar(320) NOT NULL,
  username varchar(64) NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
  CONSTRAINT users_username_lowercase CHECK (username = lower(username)),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_username_unique UNIQUE (username)
);

CREATE TABLE user_roles (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role account_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip_hash char(64)
);

CREATE INDEX sessions_active_by_user ON sessions (user_id, expires_at)
WHERE revoked_at IS NULL;

CREATE TABLE media_assets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blob_url text NOT NULL UNIQUE,
  blob_pathname text NOT NULL UNIQUE,
  content_type varchar(128) NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  width integer CHECK (width > 0),
  height integer CHECK (height > 0),
  uploaded_by_user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_user_id bigint NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  default_locale varchar(10) NOT NULL DEFAULT 'es-MX',
  photo_media_id bigint REFERENCES media_assets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile_translations (
  profile_id bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  locale varchar(10) NOT NULL,
  display_name varchar(160) NOT NULL,
  headline varchar(255) NOT NULL,
  biography text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, locale)
);

CREATE TABLE social_links (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform varchar(64) NOT NULL,
  url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_links_profile_platform_unique UNIQUE (profile_id, platform)
);

CREATE TABLE tags (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug varchar(96) NOT NULL UNIQUE,
  name varchar(96) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tags_slug_lowercase CHECK (slug = lower(slug))
);

CREATE TABLE project_roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug varchar(96) NOT NULL UNIQUE,
  name varchar(96) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_roles_slug_lowercase CHECK (slug = lower(slug))
);

CREATE TABLE projects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status content_status NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  featured_order integer,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_date_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT projects_published_at CHECK ((status = 'published' AND published_at IS NOT NULL) OR status <> 'published')
);

CREATE INDEX projects_public_order ON projects (published_at DESC, featured_order ASC NULLS LAST)
WHERE status = 'published';

CREATE TABLE project_translations (
  project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  locale varchar(10) NOT NULL,
  slug varchar(128) NOT NULL,
  title varchar(180) NOT NULL,
  summary varchar(400) NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, locale),
  CONSTRAINT project_translations_slug_lowercase CHECK (slug = lower(slug)),
  CONSTRAINT project_translations_locale_slug_unique UNIQUE (locale, slug)
);

CREATE TABLE project_tags (
  project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (project_id, tag_id)
);

CREATE TABLE project_project_roles (
  project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_role_id bigint NOT NULL REFERENCES project_roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (project_id, project_role_id)
);

CREATE TABLE project_media (
  project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_asset_id bigint NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  alt_text text NOT NULL,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (project_id, media_asset_id)
);

CREATE UNIQUE INDEX project_media_single_primary ON project_media (project_id)
WHERE is_primary;

CREATE TABLE skills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status content_status NOT NULL DEFAULT 'draft',
  group_name skill_group NOT NULL,
  proficiency smallint NOT NULL CHECK (proficiency BETWEEN 0 AND 100),
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skills_published_at CHECK ((status = 'published' AND published_at IS NOT NULL) OR status <> 'published')
);

CREATE INDEX skills_public_display ON skills (group_name, display_order)
WHERE status = 'published';

CREATE TABLE skill_translations (
  skill_id bigint NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  locale varchar(10) NOT NULL,
  name varchar(128) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (skill_id, locale)
);

CREATE TABLE learning_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status content_status NOT NULL DEFAULT 'draft',
  type learning_type NOT NULL,
  provider varchar(160) NOT NULL,
  credential_url text,
  started_on date,
  completed_on date,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_entries_date_order CHECK (completed_on IS NULL OR started_on IS NULL OR completed_on >= started_on),
  CONSTRAINT learning_entries_published_at CHECK ((status = 'published' AND published_at IS NOT NULL) OR status <> 'published')
);

CREATE INDEX learning_entries_public_display ON learning_entries (type, display_order)
WHERE status = 'published';

CREATE TABLE learning_translations (
  learning_entry_id bigint NOT NULL REFERENCES learning_entries(id) ON DELETE CASCADE,
  locale varchar(10) NOT NULL,
  title varchar(180) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learning_entry_id, locale)
);

CREATE TABLE contact_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(160) NOT NULL,
  email varchar(320) NOT NULL,
  subject varchar(255),
  message text NOT NULL,
  status contact_status NOT NULL DEFAULT 'new',
  spam_score numeric(5, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_messages_email_lowercase CHECK (email = lower(email))
);

CREATE INDEX contact_messages_inbox ON contact_messages (status, created_at DESC);

CREATE TABLE contact_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contact_message_id bigint NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
  actor_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  event_type varchar(64) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  action varchar(96) NOT NULL,
  entity_type varchar(96) NOT NULL,
  entity_id bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_entity ON audit_log (entity_type, entity_id, created_at DESC);

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profile_translations_set_updated_at BEFORE UPDATE ON profile_translations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER social_links_set_updated_at BEFORE UPDATE ON social_links
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tags_set_updated_at BEFORE UPDATE ON tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER project_roles_set_updated_at BEFORE UPDATE ON project_roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER project_translations_set_updated_at BEFORE UPDATE ON project_translations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER skills_set_updated_at BEFORE UPDATE ON skills
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER skill_translations_set_updated_at BEFORE UPDATE ON skill_translations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER learning_entries_set_updated_at BEFORE UPDATE ON learning_entries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER learning_translations_set_updated_at BEFORE UPDATE ON learning_translations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER contact_messages_set_updated_at BEFORE UPDATE ON contact_messages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
