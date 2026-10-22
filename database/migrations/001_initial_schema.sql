CREATE TABLE IF NOT EXISTS portfolio_profile (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_about (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_services (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon_path text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS portfolio_education (
  id text PRIMARY KEY,
  institution text NOT NULL,
  period text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS portfolio_experience (
  id text PRIMARY KEY,
  organization text NOT NULL,
  period text NOT NULL DEFAULT '',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS portfolio_skills (
  id text PRIMARY KEY,
  name text NOT NULL,
  proficiency numeric(5,2),
  category text NOT NULL DEFAULT 'skill',
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS portfolio_languages (
  id text PRIMARY KEY,
  name text NOT NULL,
  proficiency numeric(5,2),
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_categories (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS portfolio_projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  image_path text NOT NULL,
  project_url text NOT NULL,
  category_id text REFERENCES project_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS portfolio_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
