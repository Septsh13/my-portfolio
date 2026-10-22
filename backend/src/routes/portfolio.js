const express = require('express');
const { pool } = require('../config/database');
const asyncHandler = require('../utils/async-handler');
const router = express.Router();

router.get('/', asyncHandler(async (_req, res) => {
  const [profile, about, services, education, experience, skills, languages, categories, projects, contact] = await Promise.all([
    pool.query('SELECT content,media_id FROM portfolio_profile WHERE id=1'),
    pool.query('SELECT content FROM portfolio_about WHERE id=1'),
    pool.query('SELECT id,title,description,icon_path AS icon,link_url AS "linkUrl",media_id AS "mediaId",sort_order AS "sortOrder" FROM portfolio_services ORDER BY sort_order,id'),
    pool.query('SELECT id,institution,period,description,details,sort_order AS "sortOrder" FROM portfolio_education ORDER BY sort_order,id'),
    pool.query('SELECT id,organization,period,content,details,sort_order AS "sortOrder" FROM portfolio_experience ORDER BY sort_order,id'),
    pool.query('SELECT id,name,proficiency,category,icon,details,sort_order AS "sortOrder" FROM portfolio_skills ORDER BY sort_order,id'),
    pool.query('SELECT id,name,proficiency,sort_order AS "sortOrder" FROM portfolio_languages ORDER BY sort_order,id'),
    pool.query('SELECT id,name,sort_order AS "sortOrder" FROM project_categories ORDER BY sort_order,name'),
    pool.query(`SELECT p.id,p.name,p.image_path AS "imagePath",p.project_url AS "projectUrl",p.description,p.github_url AS "githubUrl",p.demo_url AS "demoUrl",p.technologies,p.media_id AS "mediaId",p.sort_order AS "sortOrder",
      COALESCE(json_agg(json_build_object('id',c.id,'name',c.name) ORDER BY c.sort_order) FILTER (WHERE c.id IS NOT NULL),'[]') AS categories
      FROM portfolio_projects p LEFT JOIN project_category_assignments a ON a.project_id=p.id LEFT JOIN project_categories c ON c.id=a.category_id
      WHERE p.published=true GROUP BY p.id ORDER BY p.sort_order,p.id`),
    pool.query('SELECT heading,description,displayed_email AS "displayedEmail",displayed_phone AS "displayedPhone",displayed_location AS "displayedLocation",form_enabled AS "formEnabled" FROM contact_settings WHERE id=1')
  ]);
  const rawProfile = profile.rows[0]?.content || {};
  const social = await pool.query('SELECT id,label,url,icon,sort_order AS "sortOrder" FROM profile_social_links ORDER BY sort_order,id');
  const publicProfile = { ...rawProfile, image: profile.rows[0]?.media_id ? `/api/media/${profile.rows[0].media_id}` : rawProfile.image, socialLinks: social.rowCount ? social.rows : (rawProfile.socialLinks || []).map((url) => ({ url })) };
  const publicProjects = projects.rows.map((p) => ({ ...p, image: p.mediaId ? `/api/media/${p.mediaId}` : p.imagePath, category: p.categories[0]?.name || '' }));
  res.json({ profile: publicProfile, about: about.rows[0]?.content || { paragraphs: [] }, services: services.rows.map((s) => ({ ...s, image: s.mediaId ? `/api/media/${s.mediaId}` : s.icon })), education: education.rows, experience: experience.rows, skills: skills.rows, languages: languages.rows, categories: categories.rows, projects: publicProjects, contact: contact.rows[0] || null });
}));

router.get('/profile', asyncHandler(async (_req, res) => {
  const r = await pool.query('SELECT content,media_id FROM portfolio_profile WHERE id=1');
  const content = r.rows[0]?.content || {};
  res.json({ ...content, mediaId: r.rows[0]?.media_id || null, image: r.rows[0]?.media_id ? `/api/media/${r.rows[0].media_id}` : content.image });
}));
router.get('/about', asyncHandler(async (_req, res) => {
  const r = await pool.query('SELECT content FROM portfolio_about WHERE id=1');
  res.json(r.rows[0]?.content || { paragraphs: [] });
}));
router.get('/services', asyncHandler(async (_req, res) => res.json((await pool.query('SELECT id,title,description,icon_path AS icon,link_url AS "linkUrl",media_id AS "mediaId",sort_order AS "sortOrder" FROM portfolio_services ORDER BY sort_order,id')).rows)));
router.get('/education', asyncHandler(async (_req, res) => res.json((await pool.query('SELECT id,institution,period,description,details,sort_order AS "sortOrder" FROM portfolio_education ORDER BY sort_order,id')).rows)));
router.get('/experiences', asyncHandler(async (_req, res) => res.json((await pool.query('SELECT id,organization,period,content,details,sort_order AS "sortOrder" FROM portfolio_experience ORDER BY sort_order,id')).rows)));
router.get('/skills', asyncHandler(async (_req, res) => res.json((await pool.query('SELECT id,name,proficiency,category,icon,details,sort_order AS "sortOrder" FROM portfolio_skills ORDER BY sort_order,id')).rows)));
router.get('/skill-categories', asyncHandler(async (_req,res)=>res.json((await pool.query('SELECT id,name,sort_order AS "sortOrder" FROM skill_categories ORDER BY sort_order,name')).rows)));
router.get('/languages', asyncHandler(async (_req, res) => res.json((await pool.query('SELECT id,name,proficiency,details,sort_order AS "sortOrder" FROM portfolio_languages ORDER BY sort_order,id')).rows)));
router.get('/project-categories', asyncHandler(async (_req, res) => res.json((await pool.query('SELECT id,name,sort_order AS "sortOrder" FROM project_categories ORDER BY sort_order,name')).rows)));
router.get('/projects', asyncHandler(async (_req, res) => res.json((await pool.query(`SELECT p.id,p.name,p.image_path AS "imagePath",p.project_url AS "projectUrl",p.description,p.github_url AS "githubUrl",p.demo_url AS "demoUrl",p.technologies,p.published,p.sort_order AS "sortOrder",p.media_id AS "mediaId",COALESCE(array_agg(a.category_id) FILTER (WHERE a.category_id IS NOT NULL),'{}') AS "categoryIds" FROM portfolio_projects p LEFT JOIN project_category_assignments a ON a.project_id=p.id GROUP BY p.id ORDER BY p.sort_order,p.id`)).rows)));
router.get('/contact-settings', asyncHandler(async (_req, res) => {
  const r = await pool.query('SELECT heading,description,displayed_email AS "displayedEmail",displayed_phone AS "displayedPhone",displayed_location AS "displayedLocation",form_enabled AS "formEnabled" FROM contact_settings WHERE id=1');
  res.json(r.rows[0] || null);
}));

module.exports = router;
