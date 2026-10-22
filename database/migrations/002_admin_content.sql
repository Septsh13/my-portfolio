CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions(expire);

CREATE TABLE IF NOT EXISTS profile_social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  url text NOT NULL,
  icon text NOT NULL DEFAULT 'link-outline',
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/gif','image/webp')),
  file_size integer NOT NULL CHECK (file_size BETWEEN 1 AND 8388608),
  alt_text text NOT NULL DEFAULT '',
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portfolio_profile ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE portfolio_services ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE portfolio_services ADD COLUMN IF NOT EXISTS link_url text;
ALTER TABLE portfolio_education ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE portfolio_experience ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE portfolio_skills ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE portfolio_skills ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE portfolio_languages ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE project_categories ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS github_url text;
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS demo_url text;
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS technologies jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS skill_categories (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0
);
INSERT INTO skill_categories(id,name,sort_order)
SELECT 'skill-category-' || row_number() OVER (ORDER BY category), category,
       row_number() OVER (ORDER BY category)-1
FROM (SELECT DISTINCT category FROM portfolio_skills WHERE category <> 'skill') categories
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS project_category_assignments (
  project_id text NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
  category_id text NOT NULL REFERENCES project_categories(id) ON DELETE CASCADE,
  PRIMARY KEY(project_id, category_id)
);
INSERT INTO project_category_assignments(project_id,category_id)
SELECT id,category_id FROM portfolio_projects WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS contact_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  recipient_email text NOT NULL DEFAULT '',
  heading text NOT NULL DEFAULT 'Contact',
  description text NOT NULL DEFAULT '',
  displayed_email text NOT NULL DEFAULT '',
  displayed_phone text NOT NULL DEFAULT '',
  displayed_location text NOT NULL DEFAULT '',
  form_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO contact_settings(id,recipient_email,displayed_email,displayed_phone,displayed_location)
SELECT 1, COALESCE(content->>'email',''), COALESCE(content->>'email',''),
       COALESCE(content->>'phone',''), COALESCE(content->>'location','')
FROM portfolio_profile WHERE id=1
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS portfolio_projects_order_idx ON portfolio_projects(sort_order);
CREATE INDEX IF NOT EXISTS portfolio_education_order_idx ON portfolio_education(sort_order);
CREATE INDEX IF NOT EXISTS portfolio_experience_order_idx ON portfolio_experience(sort_order);
CREATE INDEX IF NOT EXISTS portfolio_skills_order_idx ON portfolio_skills(sort_order);
