const path = require('node:path');
const backendRoot = path.resolve(__dirname, '../../backend');
require(require.resolve('dotenv', { paths: [backendRoot] })).config({ path: path.resolve(backendRoot, '.env') });
const fs = require('node:fs');
const { pool } = require(path.join(backendRoot, 'src/config/database'));

const source = path.resolve(__dirname, 'source-portfolio.html');
const html = fs.readFileSync(source, 'utf8');
const decode = (value) => value
  .replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();
const textOf = (value) => decode(value.replace(/<[^>]*>/g, ''));
const attr = (tag = '', name) => {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'));
  return match ? decode(match[1]) : '';
};
const one = (pattern, fallback = '') => (html.match(pattern) || [null, fallback])[1];

const profile = {
  fullName: textOf(one(/<h1 class="name"[^>]*>([\s\S]*?)<\/h1>/i)),
  title: textOf(one(/<p class="title">([\s\S]*?)<\/p>/i)),
  image: attr((html.match(/<img[^>]*>/i) || [''])[0], 'src'),
  imageAlt: attr((html.match(/<img[^>]*>/i) || [''])[0], 'alt'),
  email: attr((html.match(/<a[^>]+class="contact-link"[^>]*>/i) || [''])[0], 'href').replace(/^mailto:/, ''),
  emailDisplay: textOf((html.match(/<a[^>]+class="contact-link"[^>]*>([\s\S]*?)<\/a>/i) || [null, ''])[1]),
  phone: textOf(one(/<a href="tel:[^"]+" class="contact-link">([\s\S]*?)<\/a>/i)),
  phoneLink: ((html.match(/<a href="(tel:[^"]+)" class="contact-link">/i) || [null, ''])[1]).replace(/^tel:/, ''),
  birthday: textOf(one(/<time[^>]*>([\s\S]*?)<\/time>/i)),
  birthdayDate: attr((html.match(/<time[^>]*>/i) || [''])[0], 'datetime'),
  location: textOf(one(/<address>([\s\S]*?)<\/address>/i)),
  socialLinks: [...html.matchAll(/<a href="(https?:[^" ]+)" class="social-link"/gi)].map((m) => decode(m[1]))
};
const aboutMatch = html.match(/<section class="about-text">([\s\S]*?)<\/section>/i);
const about = aboutMatch ? [...aboutMatch[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => textOf(m[1])) : [];
const services = [...html.matchAll(/<li class="service-item">([\s\S]*?)<\/li>/gi)].map((m, i) => {
  const block = m[1];
  return { id: `service-${i + 1}`, title: textOf((block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i) || [null, ''])[1]), description: textOf((block.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [null, ''])[1]), icon: attr((block.match(/<img[^>]*>/i) || [''])[0], 'src'), order: i };
});
const educationBlock = (html.match(/<h3 class="h3">Education<\/h3>[\s\S]*?<ol class="timeline-list">([\s\S]*?)<\/ol>/i) || [null, ''])[1];
const education = [...educationBlock.matchAll(/<li class="timeline-item">([\s\S]*?)<\/li>/gi)].map((m, i) => ({ id: `education-${i + 1}`, institution: textOf((m[1].match(/<h4[^>]*>([\s\S]*?)<\/h4>/i) || [null, ''])[1]), period: textOf((m[1].match(/<span[^>]*>([\s\S]*?)<\/span>/i) || [null, ''])[1]), description: textOf((m[1].match(/<p class="timeline-text">([\s\S]*?)<\/p>/i) || [null, ''])[1]), order: i }));
const skillsBlock = (html.match(/<h3 class="h3 skills-title">My skills<\/h3>[\s\S]*?<ul class="skills-list content-card">([\s\S]*?)<\/ul>/i) || [null, ''])[1];
const skills = [...skillsBlock.matchAll(/<li class="skills-item">([\s\S]*?)<\/li>/gi)].map((m, i) => ({ id: `skill-${i + 1}`, name: textOf((m[1].match(/<h5[^>]*>([\s\S]*?)<\/h5>/i) || [null, ''])[1]), proficiency: Number((m[1].match(/<data value="([0-9.]+)"/i) || [null, '0'])[1]), category: 'skill', order: i }));
const languageBlock = (html.match(/<h3 class="h3 skills-title">Languages<\/h3>[\s\S]*?<ul class="skills-list content-card">([\s\S]*?)<\/ul>/i) || [null, ''])[1];
const languages = [...languageBlock.matchAll(/<li class="skills-item">([\s\S]*?)<\/li>/gi)].map((m, i) => ({ id: `language-${i + 1}`, name: textOf((m[1].match(/<h5[^>]*>([\s\S]*?)<\/h5>/i) || [null, ''])[1]), proficiency: Number((m[1].match(/<data value="([0-9.]+)"/i) || [null, '0'])[1]), order: i }));
const categoryNames = [...new Set([...html.matchAll(/<button data-filter-btn>([^<]+)<\/button>/gi)].map((m) => textOf(m[1])))];
const categories = categoryNames.map((name, i) => ({ id: `category-${i + 1}`, name, order: i }));
const categoryIds = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
const projectBlock = (html.match(/<ul class="project-list">([\s\S]*?)<\/ul>/i) || [null, ''])[1];
const projects = [...projectBlock.matchAll(/<li class="project-item[^\"]*"[^>]*data-category="([^"]+)"[^>]*>([\s\S]*?)<\/li>/gi)].map((m, i) => {
  const block = m[2];
  return { id: `project-${i + 1}`, name: textOf((block.match(/<h3 class="project-title">([\s\S]*?)<\/h3>/i) || [null, ''])[1]), image: attr((block.match(/<img[^>]*>/i) || [''])[0], 'src'), url: attr((block.match(/<a[^>]*class="project-github-link"[^>]*>/i) || [''])[0], 'href'), category: decode(m[1]), categoryId: categoryIds.get(decode(m[1]).toLowerCase()), order: i };
});

(async () => {
  const connection = await pool.query('SELECT current_database() AS db');
  console.log(`Verified connection to ${connection.rows[0].db}.`);
  const migration = await pool.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists");
  if (!migration.rows[0].exists) throw new Error('Schema is not migrated; run npm run db:migrate first.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO portfolio_profile(id, content) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [profile]);
    await client.query('INSERT INTO portfolio_about(id, content) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [{ paragraphs: about, sectionTitle: 'About me', servicesTitle: "What i'm doing" }]);
    await client.query(`UPDATE contact_settings SET recipient_email=COALESCE(NULLIF(recipient_email,''),$1),displayed_email=COALESCE(NULLIF(displayed_email,''),$2),displayed_phone=COALESCE(NULLIF(displayed_phone,''),$3),displayed_location=COALESCE(NULLIF(displayed_location,''),$4) WHERE id=1`, [profile.email,profile.emailDisplay,profile.phone,profile.location]);
    for (const [i,url] of profile.socialLinks.entries()) {
      const label = url.includes('github') ? 'GitHub' : url.includes('linkedin') ? 'LinkedIn' : 'Social';
      await client.query('INSERT INTO profile_social_links(label,url,icon,sort_order) SELECT $1,$2,$3,$4 WHERE NOT EXISTS(SELECT 1 FROM profile_social_links WHERE url=$2)', [label,url,url.includes('github')?'logo-github':url.includes('linkedin')?'logo-linkedin':'link-outline',i]);
    }
    for (const item of services) await client.query('INSERT INTO portfolio_services(id,title,description,icon_path,sort_order) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING', [item.id,item.title,item.description,item.icon,item.order]);
    for (const item of education) await client.query('INSERT INTO portfolio_education(id,institution,period,description,sort_order) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING', [item.id,item.institution,item.period,item.description,item.order]);
    for (const item of skills) await client.query('INSERT INTO portfolio_skills(id,name,proficiency,category,sort_order) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING', [item.id,item.name,item.proficiency,item.category,item.order]);
    for (const item of languages) await client.query('INSERT INTO portfolio_languages(id,name,proficiency,sort_order) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING', [item.id,item.name,item.proficiency,item.order]);
    for (const item of categories) await client.query('INSERT INTO project_categories(id,name,sort_order) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [item.id,item.name,item.order]);
    for (const item of projects) {
      if (!item.name || !item.image || !item.url || !item.categoryId) throw new Error(`Could not safely parse project ${item.id}; seed transaction rolled back.`);
      await client.query('INSERT INTO portfolio_projects(id,name,image_path,project_url,category_id,sort_order) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING', [item.id,item.name,item.image,item.url,item.categoryId,item.order]);
    }
    const experienceBlock = (html.match(/<h3 class="h3">Experience<\/h3>[\s\S]*?<ol class="timeline-list">([\s\S]*?)<\/ol>/i) || [null, ''])[1];
    for (const [i, match] of [...experienceBlock.matchAll(/<li class="timeline-item">([\s\S]*?)<\/li>/gi)].entries()) {
      const block = match[1];
      const organization = textOf((block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i) || [null, ''])[1]);
      const period = textOf((block.match(/<span[^>]*>([\s\S]*?)<\/span>/i) || [null, ''])[1]);
      const description = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((p) => textOf(p[1]));
      await client.query('INSERT INTO portfolio_experience(id,organization,period,content,sort_order) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING', [`experience-${i + 1}`,organization,period,{ paragraphs: description },i]);
    }
    await client.query('INSERT INTO portfolio_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING', ['source_import', { file: 'index.html', importedAt: new Date().toISOString() }]);
    await client.query('COMMIT');
    console.log(`Imported existing portfolio: ${services.length} services, ${education.length} education entries, ${skills.length} skills, ${languages.length} languages, ${projects.length} projects, ${categories.length} categories.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
})().catch((error) => {
  console.error(`Seed stopped safely: ${error.message}`);
  process.exitCode = 1;
}).finally(() => pool.end());
