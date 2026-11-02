ALTER TABLE projects
  ADD COLUMN github_url text,
  ADD COLUMN website_url text,
  ADD COLUMN cover_image_url text,
  ADD COLUMN gallery_image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
