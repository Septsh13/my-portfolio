const express = require('express');
const crypto = require('node:crypto');
const { pool } = require('../config/database');
const { requireAdmin, requireCsrf } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const router = express.Router();
router.use(requireAdmin);
router.use((req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():requireCsrf(req,res,next));

const specs = {
  services: { table:'portfolio_services', columns:['title','description','icon_path','sort_order','link_url','media_id'], required:['title'], select:'id,title,description,icon_path AS icon,link_url AS "linkUrl",media_id AS "mediaId",sort_order AS "sortOrder"', map:{icon:'icon_path',linkUrl:'link_url',mediaId:'media_id',sortOrder:'sort_order'} },
  education: { table:'portfolio_education', columns:['institution','period','description','details','sort_order'], required:['institution'], select:'id,institution,period,description,details,sort_order AS "sortOrder"', map:{sortOrder:'sort_order'} },
  experiences: { table:'portfolio_experience', columns:['organization','period','content','details','sort_order'], required:['organization'], select:'id,organization,period,content,details,sort_order AS "sortOrder"', map:{sortOrder:'sort_order'} },
  skills: { table:'portfolio_skills', columns:['name','proficiency','category','icon','details','sort_order'], required:['name'], select:'id,name,proficiency,category,icon,details,sort_order AS "sortOrder"', map:{sortOrder:'sort_order'} },
  languages: { table:'portfolio_languages', columns:['name','proficiency','details','sort_order'], required:['name'], select:'id,name,proficiency,details,sort_order AS "sortOrder"', map:{sortOrder:'sort_order'} },
  'project-categories': { table:'project_categories', columns:['name','sort_order'], required:['name'], select:'id,name,sort_order AS "sortOrder"', map:{sortOrder:'sort_order'} }
  , 'skill-categories': { table:'skill_categories', columns:['name','sort_order'], required:['name'], select:'id,name,sort_order AS "sortOrder"', map:{sortOrder:'sort_order'} }
};
const clean = (value, limit=10000) => typeof value === 'string' ? value.trim().slice(0,limit) : value;
const safeLink = (value) => !value || /^(https?:\/\/|mailto:|\/assets\/|\.\/assets\/)/i.test(String(value));
const rowPayload = (body, spec) => {
  const result = {};
  for (const col of spec.columns) {
    const key = Object.keys(spec.map || {}).find((k) => spec.map[k] === col) || col;
    if (body[key] === undefined) continue;
    if (col === 'details' || col === 'content') result[col] = body[key] && typeof body[key] === 'object' ? body[key] : {};
    else if (col === 'sort_order') result[col] = Number.isInteger(Number(body[key])) ? Number(body[key]) : 0;
    else if (col === 'proficiency') result[col] = body[key] === '' || body[key] == null ? null : Math.max(0, Math.min(100, Number(body[key]) || 0));
    else result[col] = clean(body[key], col.includes('url') || col==='icon_path' ? 2000 : 10000);
  }
  return result;
};
function routeEntity(name, spec) {
  router.get(`/${name}`, asyncHandler(async (_req,res) => res.json((await pool.query(`SELECT ${spec.select} FROM ${spec.table} ORDER BY sort_order,id`)).rows)));
  router.put(`/${name}/reorder`, asyncHandler(async(req,res)=>{const ids=req.body?.ids;if(!Array.isArray(ids)||ids.length>1000||new Set(ids).size!==ids.length)return res.status(400).json({error:'Provide a unique list of record IDs.'});const client=await pool.connect();try{await client.query('BEGIN');for(const [index,id] of ids.entries())await client.query(`UPDATE ${spec.table} SET sort_order=$1 WHERE id=$2`,[index,id]);await client.query('COMMIT');res.json({reordered:ids.length});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}));
  router.post(`/${name}`, asyncHandler(async (req,res) => {
    const data=rowPayload(req.body||{},spec);
    const missing=spec.required.find((key)=>!data[key]);
    if(missing) return res.status(400).json({error:`${missing} is required.`});
    for(const [key,value] of Object.entries(data)) if((key.endsWith('_url')||key==='url')&&value&&!safeLink(value)) return res.status(400).json({error:'Links must use http, https, mailto, or a local /assets path.'});
    if(data.details?.websiteUrl&&!safeLink(data.details.websiteUrl)||data.details?.logoUrl&&!safeLink(data.details.logoUrl)) return res.status(400).json({error:'Company links must use http, https, or a local /assets path.'});
    if(name==='project-categories' && (await pool.query('SELECT 1 FROM project_categories WHERE lower(name)=lower($1)',[data.name])).rowCount) return res.status(409).json({error:'That category already exists.'});
    const id=crypto.randomUUID(); const cols=['id',...Object.keys(data)]; const vals=[id,...Object.values(data)];
    const params=vals.map((_,i)=>`$${i+1}`);
    const inserted=await pool.query(`INSERT INTO ${spec.table}(${cols.join(',')}) VALUES(${params.join(',')}) RETURNING ${spec.select}`,vals);
    res.status(201).json(inserted.rows[0]);
  }));
  router.put(`/${name}/:id`, asyncHandler(async (req,res) => {
    const data=rowPayload(req.body||{},spec); const missing=spec.required.find((key)=>data[key]!==undefined&&!data[key]);
    if(missing) return res.status(400).json({error:`${missing} is required.`});
    for(const [key,value] of Object.entries(data)) if((key.endsWith('_url')||key==='url')&&value&&!safeLink(value)) return res.status(400).json({error:'Links must use http, https, mailto, or a local /assets path.'});
    if(data.details?.websiteUrl&&!safeLink(data.details.websiteUrl)||data.details?.logoUrl&&!safeLink(data.details.logoUrl)) return res.status(400).json({error:'Company links must use http, https, or a local /assets path.'});
    if(!Object.keys(data).length) return res.status(400).json({error:'No editable fields supplied.'});
    const sets=Object.keys(data).map((key,i)=>`${key}=$${i+1}`); const vals=Object.values(data);
    if(name==='project-categories' && data.name && (await pool.query('SELECT 1 FROM project_categories WHERE lower(name)=lower($1) AND id<>$2',[data.name,req.params.id])).rowCount) return res.status(409).json({error:'That category already exists.'});
    const out=await pool.query(`UPDATE ${spec.table} SET ${sets.join(',')} WHERE id=$${vals.length+1} RETURNING ${spec.select}`,[...vals,req.params.id]);
    if(!out.rowCount) return res.status(404).json({error:'Record not found.'}); res.json(out.rows[0]);
  }));
  router.delete(`/${name}/:id`, asyncHandler(async (req,res) => {
    if(name==='project-categories') {
      const used=await pool.query('SELECT 1 FROM project_category_assignments WHERE category_id=$1 LIMIT 1',[req.params.id]);
      if(used.rowCount) return res.status(409).json({error:'Remove this category from its projects before deleting it.'});
    }
    if(name==='skill-categories') {
      const used=await pool.query('SELECT 1 FROM portfolio_skills WHERE lower(category)=(SELECT lower(name) FROM skill_categories WHERE id=$1) LIMIT 1',[req.params.id]);
      if(used.rowCount) return res.status(409).json({error:'This category is used by skills. Reassign those skills before deleting it.'});
    }
    const out=await pool.query(`DELETE FROM ${spec.table} WHERE id=$1 RETURNING id`,[req.params.id]);
    if(!out.rowCount) return res.status(404).json({error:'Record not found.'}); res.status(204).end();
  }));
}
for(const [name,spec] of Object.entries(specs)) routeEntity(name,spec);

router.get('/dashboard', asyncHandler(async (_req,res)=>{
  const r=await pool.query(`SELECT (SELECT count(*) FROM portfolio_projects)::int AS "totalProjects",(SELECT count(*) FROM portfolio_projects WHERE published)::int AS "publishedProjects",(SELECT count(*) FROM portfolio_experience)::int AS "totalExperience",(SELECT count(*) FROM portfolio_skills)::int AS "totalSkills",(SELECT count(*) FROM portfolio_education)::int AS "totalEducation"`); res.json(r.rows[0]);
}));
router.get('/profile', asyncHandler(async (_req,res)=>{const r=await pool.query('SELECT content,media_id AS "mediaId" FROM portfolio_profile WHERE id=1');const c=r.rows[0]?.content||{};res.json({...c,socialLinks:(c.socialLinks||[]).map(item=>typeof item==='string'?{label:item,url:item,icon:'link-outline'}:item),mediaId:r.rows[0]?.mediaId||null});}));
router.put('/profile', asyncHandler(async (req,res)=>{
  const body=req.body||{}; const allowed=['fullName','title','description','image','imageAlt','email','emailDisplay','phone','phoneLink','birthday','birthdayDate','location','socialLinks']; const content={};
  for(const key of allowed) if(body[key]!==undefined) content[key]=key==='socialLinks'&&Array.isArray(body[key])?body[key].slice(0,40).map((item)=>{const url=typeof item==='string'?item:item.url;return {label:clean(typeof item==='string'?item:item.label,80),url:clean(url,2000),icon:clean(typeof item==='string'?'link-outline':item.icon,80)}}):clean(body[key],10000);
  if(body.socialLinks!==undefined && (!Array.isArray(body.socialLinks)||body.socialLinks.length>40)) return res.status(400).json({error:'Social links must be a list of at most 40 links.'});
  if(content.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.email)) return res.status(400).json({error:'Enter a valid profile email address.'});
  if(content.image&&!safeLink(content.image)) return res.status(400).json({error:'Profile image must use http, https, or a local /assets path.'});
  if(content.phoneLink&&!/^[+0-9().\-\s]+$/.test(content.phoneLink)) return res.status(400).json({error:'Phone link contains unsupported characters.'});
  if(content.socialLinks&&content.socialLinks.some((link)=>!link.label||!link.url||!safeLink(link.url))) return res.status(400).json({error:'Each social link needs a label and a safe http or https URL.'});
  const mediaId=body.mediaId===undefined?undefined:(body.mediaId||null);
  const client=await pool.connect();
  try{await client.query('BEGIN');const r=await client.query('UPDATE portfolio_profile SET content=content||$1::jsonb, media_id=CASE WHEN $2::boolean THEN $3::uuid ELSE media_id END,updated_at=now() WHERE id=1 RETURNING content,media_id AS "mediaId"',[content,mediaId!==undefined,mediaId]);
  if(!r.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'Profile record is missing.'});}
  if(content.socialLinks){await client.query('DELETE FROM profile_social_links');for(const [i,item] of content.socialLinks.entries()){const link=typeof item==='string'?{label:item,url:item,icon:'link-outline'}:item;await client.query('INSERT INTO profile_social_links(label,url,icon,sort_order) VALUES($1,$2,$3,$4)',[link.label,link.url,link.icon||'link-outline',i]);}}
  await client.query('COMMIT');res.json({...r.rows[0].content,mediaId:r.rows[0].mediaId});}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
router.get('/about',asyncHandler(async(_req,res)=>res.json((await pool.query('SELECT content FROM portfolio_about WHERE id=1')).rows[0]?.content||{})));
router.put('/about',asyncHandler(async(req,res)=>{const c=req.body||{};if(c.paragraphs!==undefined&&(!Array.isArray(c.paragraphs)||c.paragraphs.some(x=>typeof x!=='string')))return res.status(400).json({error:'About paragraphs must be a list of text.'});const cleanContent={};for(const k of ['heading','paragraphs','summary','servicesTitle'])if(c[k]!==undefined)cleanContent[k]=Array.isArray(c[k])?c[k].slice(0,30).map(x=>clean(x,5000)):clean(c[k],5000);const r=await pool.query('UPDATE portfolio_about SET content=content||$1::jsonb,updated_at=now() WHERE id=1 RETURNING content',[cleanContent]);res.json(r.rows[0]?.content||{});}));

router.get('/projects',asyncHandler(async(_req,res)=>res.json((await pool.query(`SELECT p.id,p.name,p.image_path AS "imagePath",p.project_url AS "projectUrl",p.description,p.github_url AS "githubUrl",p.demo_url AS "demoUrl",p.technologies,p.published,p.media_id AS "mediaId",p.sort_order AS "sortOrder",COALESCE(array_agg(a.category_id) FILTER(WHERE a.category_id IS NOT NULL),'{}') AS "categoryIds" FROM portfolio_projects p LEFT JOIN project_category_assignments a ON a.project_id=p.id GROUP BY p.id ORDER BY p.sort_order,p.id`)).rows)));
router.put('/projects/reorder',asyncHandler(async(req,res)=>{const ids=req.body?.ids;if(!Array.isArray(ids)||ids.length>1000||new Set(ids).size!==ids.length)return res.status(400).json({error:'Provide a unique list of project IDs.'});const client=await pool.connect();try{await client.query('BEGIN');for(const [index,id] of ids.entries())await client.query('UPDATE portfolio_projects SET sort_order=$1 WHERE id=$2',[index,id]);await client.query('COMMIT');res.json({reordered:ids.length});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}));
function projectData(body){return {name:clean(body.name,200),imagePath:clean(body.imagePath||'',2000),projectUrl:clean(body.projectUrl||'',2000),description:clean(body.description||'',5000),githubUrl:clean(body.githubUrl||'',2000),demoUrl:clean(body.demoUrl||'',2000),technologies:Array.isArray(body.technologies)?body.technologies.slice(0,50).map(x=>clean(String(x),100)):[],published:body.published!==false,sortOrder:Number.isInteger(Number(body.sortOrder))?Number(body.sortOrder):0,mediaId:body.mediaId||null,categoryIds:Array.isArray(body.categoryIds)?[...new Set(body.categoryIds.map(String))].slice(0,30):[]};}
async function saveProject(client,id,d){
  if(!d.name||!d.projectUrl||(!d.imagePath&&!d.mediaId)) throw Object.assign(new Error('Project name, image, and project link are required.'),{status:400});
  if(d.categoryIds.length){const found=await client.query('SELECT id FROM project_categories WHERE id=ANY($1::text[])', [d.categoryIds]);if(found.rowCount!==d.categoryIds.length)throw Object.assign(new Error('One or more project categories do not exist.'),{status:400});}
  await client.query(`INSERT INTO portfolio_projects(id,name,image_path,project_url,description,github_url,demo_url,technologies,published,sort_order,media_id,category_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,image_path=EXCLUDED.image_path,project_url=EXCLUDED.project_url,description=EXCLUDED.description,github_url=EXCLUDED.github_url,demo_url=EXCLUDED.demo_url,technologies=EXCLUDED.technologies,published=EXCLUDED.published,sort_order=EXCLUDED.sort_order,media_id=EXCLUDED.media_id,category_id=EXCLUDED.category_id`,
  [id,d.name,d.imagePath,d.projectUrl,d.description,d.githubUrl||null,d.demoUrl||null,d.technologies,d.published,d.sortOrder,d.mediaId,d.categoryIds[0]||null]);
  await client.query('DELETE FROM project_category_assignments WHERE project_id=$1',[id]);
  for(const categoryId of d.categoryIds) await client.query('INSERT INTO project_category_assignments(project_id,category_id) VALUES($1,$2)',[id,categoryId]);
}
router.post('/projects',asyncHandler(async(req,res)=>{const d=projectData(req.body||{});if(!safeLink(d.projectUrl)||!safeLink(d.githubUrl)||!safeLink(d.demoUrl)||!safeLink(d.imagePath))return res.status(400).json({error:'Project URLs must use http, https, or a local /assets path.'});const id=crypto.randomUUID(),client=await pool.connect();try{await client.query('BEGIN');await saveProject(client,id,d);await client.query('COMMIT');res.status(201).json({id,...d});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}));
router.put('/projects/:id',asyncHandler(async(req,res)=>{const d=projectData(req.body||{});if(!safeLink(d.projectUrl)||!safeLink(d.githubUrl)||!safeLink(d.demoUrl)||!safeLink(d.imagePath))return res.status(400).json({error:'Project URLs must use http, https, or a local /assets path.'});const client=await pool.connect();try{await client.query('BEGIN');const exists=await client.query('SELECT 1 FROM portfolio_projects WHERE id=$1',[req.params.id]);if(!exists.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'Project not found.'});}await saveProject(client,req.params.id,d);await client.query('COMMIT');res.json({id:req.params.id,...d});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}));
router.delete('/projects/:id',asyncHandler(async(req,res)=>{const r=await pool.query('DELETE FROM portfolio_projects WHERE id=$1 RETURNING id',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Project not found.'});res.status(204).end();}));
router.get('/contact-settings',asyncHandler(async(_req,res)=>{const r=await pool.query('SELECT recipient_email AS "recipientEmail",heading,description,displayed_email AS "displayedEmail",displayed_phone AS "displayedPhone",displayed_location AS "displayedLocation",form_enabled AS "formEnabled" FROM contact_settings WHERE id=1');res.json(r.rows[0]||null);}));
router.put('/contact-settings',asyncHandler(async(req,res)=>{const b=req.body||{};const email=clean(b.recipientEmail,254);if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Enter a valid recipient email address.'});const r=await pool.query(`UPDATE contact_settings SET recipient_email=$1,heading=$2,description=$3,displayed_email=$4,displayed_phone=$5,displayed_location=$6,form_enabled=$7,updated_at=now() WHERE id=1 RETURNING recipient_email AS "recipientEmail",heading,description,displayed_email AS "displayedEmail",displayed_phone AS "displayedPhone",displayed_location AS "displayedLocation",form_enabled AS "formEnabled"`,[email,clean(b.heading||'Contact',200),clean(b.description||'',3000),clean(b.displayedEmail||'',254),clean(b.displayedPhone||'',80),clean(b.displayedLocation||'',200),b.formEnabled!==false]);res.json(r.rows[0]);}));

module.exports=router;
