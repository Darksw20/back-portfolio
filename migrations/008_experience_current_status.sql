ALTER TABLE experiences ADD COLUMN is_current boolean NOT NULL DEFAULT false;
ALTER TABLE experiences ADD CONSTRAINT experiences_current_end CHECK (NOT is_current OR end_month IS NULL);
