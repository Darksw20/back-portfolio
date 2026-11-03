CREATE TABLE resume_documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  locale varchar(10) NOT NULL CHECK (locale IN ('es-MX', 'en-US')),
  template varchar(24) NOT NULL CHECK (template IN ('harvard', 'original', 'modern')),
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resume_documents_owner_updated ON resume_documents (owner_user_id, updated_at DESC);
CREATE TRIGGER resume_documents_set_updated_at BEFORE UPDATE ON resume_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
