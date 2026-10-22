require('dotenv').config({path:require('node:path').resolve(__dirname,'../.env')});
const fs=require('node:fs');
const path=require('node:path');
const {pool}=require('../src/config/database');
const base=process.env.SMOKE_API_URL||'http://127.0.0.1:3000';
const email=process.env.SMOKE_ADMIN_EMAIL;
const password=process.env.SMOKE_ADMIN_PASSWORD;
if(!email||!password)throw new Error('Set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD in the test process.');
function assert(ok,message){if(!ok)throw new Error(message);}
function cookieFrom(response){const values=response.headers.getSetCookie?.()||[response.headers.get('set-cookie')||''];return values.map(x=>x.split(';')[0]).filter(Boolean).join('; ');}
async function request(path,{cookie='',csrf='',...options}={}){const headers=new Headers(options.headers||{});if(cookie)headers.set('Cookie',cookie);if(csrf)headers.set('X-CSRF-Token',csrf);if(options.body&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');return fetch(`${base}${path}`,{...options,headers});}

(async()=>{
  const health=await request('/api/health');assert(health.ok,'health endpoint failed');
  const publicResponse=await request('/api/portfolio');assert(publicResponse.ok,'public portfolio endpoint failed');const portfolio=await publicResponse.json();
  assert(portfolio.projects.length===13,'existing public project inventory changed');assert(portfolio.services.length===4,'service records missing');assert(portfolio.education.length===3&&portfolio.experience.length===1&&portfolio.skills.length===4&&portfolio.languages.length===3,'existing resume inventory changed');assert(!('recipientEmail' in portfolio.contact),'private contact recipient leaked publicly');
  for(const project of portfolio.projects){const imagePath=decodeURIComponent(String(project.imagePath||'').replace(/^\.\//,''));if(imagePath.startsWith('assets/'))assert(fs.existsSync(path.resolve(__dirname,'../../frontend/public',imagePath)),`project image missing: ${project.name}`);assert(/^https?:\/\//i.test(project.projectUrl),`project link missing: ${project.name}`);}
  const anon=await request('/api/admin/dashboard');assert(anon.status===401,'unauthenticated admin API was not rejected');
  const csrfResponse=await request('/api/auth/csrf');assert(csrfResponse.ok,'CSRF initialization failed');const anonCookie=cookieFrom(csrfResponse);const csrf=(await csrfResponse.json()).csrfToken;
  const blockedMutation=await request('/api/admin/services',{method:'POST',cookie:anonCookie,body:'{}'});assert(blockedMutation.status===401,'unauthenticated write was not rejected');
  const failedLogin=await request('/api/auth/login',{method:'POST',cookie:anonCookie,csrf,body:JSON.stringify({email,password:'incorrect password'})});assert(failedLogin.status===401,'invalid password was accepted');
  const login=await request('/api/auth/login',{method:'POST',cookie:anonCookie,csrf,body:JSON.stringify({email,password})});assert(login.ok,'admin login failed');const loginData=await login.json();const sessionCookie=cookieFrom(login)||anonCookie;const adminCsrf=loginData.csrfToken;
  const dashboard=await request('/api/admin/dashboard',{cookie:sessionCookie});assert(dashboard.ok,'authenticated dashboard failed');
  for(const route of ['profile','about','services','education','experiences','skills','skill-categories','languages','project-categories','projects','contact-settings']){const response=await request(`/api/admin/${route}`,{cookie:sessionCookie});const detail=await response.clone().json().catch(()=>({}));assert(response.ok,`admin ${route} endpoint failed (${response.status}): ${detail.error||''}`);}
  const profile=await (await request('/api/admin/profile',{cookie:sessionCookie})).json();const profileUpdate=await request('/api/admin/profile',{method:'PUT',cookie:sessionCookie,csrf:adminCsrf,body:JSON.stringify(profile)});const profileError=await profileUpdate.clone().json().catch(()=>({}));assert(profileUpdate.ok,`profile update failed (${profileUpdate.status}): ${profileError.error||''}`);
  const settings=await (await request('/api/admin/contact-settings',{cookie:sessionCookie})).json();const settingsUpdate=await request('/api/admin/contact-settings',{method:'PUT',cookie:sessionCookie,csrf:adminCsrf,body:JSON.stringify(settings)});const settingsError=await settingsUpdate.clone().json().catch(()=>({}));assert(settingsUpdate.ok,`contact settings update failed (${settingsUpdate.status}): ${settingsError.error||''}`);
  const noCsrf=await request('/api/admin/services',{method:'POST',cookie:sessionCookie,body:'{}'});assert(noCsrf.status===403,'state-changing admin request without CSRF was accepted');
  const unsafeLink=await request('/api/admin/projects',{method:'POST',cookie:sessionCookie,csrf:adminCsrf,body:JSON.stringify({name:'Unsafe URL check',imagePath:'/assets/images/project-parkinsons.jpg',projectUrl:'javascript:alert(1)'})});assert(unsafeLink.status===400,'unsafe project URL was accepted');
  if(!process.env.EMAIL_HOST){const contact=await request('/api/contact',{method:'POST',body:JSON.stringify({name:'Runtime check',email:'smoke@example.com',subject:'SMTP setup',message:'Check the unconfigured response.'})});assert(contact.status===503,'contact form claimed delivery without configured SMTP');}
  const transient=[];
  async function createRecord(route,body){const r=await request(`/api/admin/${route}`,{method:'POST',cookie:sessionCookie,csrf:adminCsrf,body:JSON.stringify(body)});const detail=await r.clone().json().catch(()=>({}));assert(r.status===201,`${route} create failed (${r.status}): ${detail.error||''}`);const value=await r.json();transient.push([route,value.id]);return value;}
  const service=await createRecord('services',{title:'Smoke test service',description:'Temporary',icon:'/assets/images/icon-dev.svg'});assert((await request(`/api/admin/services/${service.id}`,{method:'PUT',cookie:sessionCookie,csrf:adminCsrf,body:JSON.stringify({...service,title:'Updated smoke service'})})).ok,'service update failed');
  const education=await createRecord('education',{institution:'Smoke test institution',period:'2026',description:'Temporary',details:{degree:'Test'}});
  const experience=await createRecord('experiences',{organization:'Smoke test company',period:'2026',content:{paragraphs:['Temporary']},details:{role:'Test role',responsibilities:['Test task']}});
  const skillCategory=await createRecord('skill-categories',{name:'Smoke test category'});
  const skill=await createRecord('skills',{name:'Smoke test skill',category:skillCategory.name,proficiency:75,details:{}});
  const protectedDelete=await request(`/api/admin/skill-categories/${skillCategory.id}`,{method:'DELETE',cookie:sessionCookie,csrf:adminCsrf});assert(protectedDelete.status===409,'in-use skill category was not protected');
  const language=await createRecord('languages',{name:'Smoke test language',proficiency:50,details:{description:'Intermediate'}});
  const projectCategory=await createRecord('project-categories',{name:'Smoke test project category'});
  const imageBytes=fs.readFileSync(path.resolve(__dirname,'../../frontend/public/assets/images/project-parkinsons.jpg'));
  const form=new FormData();form.append('image',new Blob([imageBytes],{type:'image/jpeg'}),'smoke-check.jpg');form.append('altText','Runtime check image');
  const uploaded=await request('/api/media',{method:'POST',cookie:sessionCookie,csrf:adminCsrf,body:form});const uploadError=await uploaded.clone().json().catch(()=>({}));assert(uploaded.status===201,`image upload failed (${uploaded.status}): ${uploadError.error||''}`);const media=await uploaded.json();
  let project;
  const create=await request('/api/admin/projects',{method:'POST',cookie:sessionCookie,csrf:adminCsrf,body:JSON.stringify({name:'Temporary runtime check project',mediaId:media.id,projectUrl:'https://example.com/runtime-check',categoryIds:[projectCategory.id]})});assert(create.status===201,`project create failed (${create.status})`);project=await create.json();
  try{
    const visible=await (await request('/api/portfolio')).json();const visibleProject=visible.projects.find(p=>p.id===project.id);assert(visibleProject,'published project did not appear publicly');assert(visibleProject.image===`/api/media/${media.id}`,'uploaded image was not attached to project');
    const update=await request(`/api/admin/projects/${project.id}`,{method:'PUT',cookie:sessionCookie,csrf:adminCsrf,body:JSON.stringify({...project,published:false})});assert(update.ok,'project unpublish failed');
    const hidden=await (await request('/api/portfolio')).json();assert(!hidden.projects.some(p=>p.id===project.id),'unpublished project remained public');
  }finally{
    const remove=await request(`/api/admin/projects/${project.id}`,{method:'DELETE',cookie:sessionCookie,csrf:adminCsrf});assert(remove.status===204,'temporary project cleanup failed');
    await pool.query('DELETE FROM media_assets WHERE id=$1',[media.id]);
  }
  const skillCleanup=await request(`/api/admin/skills/${skill.id}`,{method:'DELETE',cookie:sessionCookie,csrf:adminCsrf});assert(skillCleanup.status===204,'skill cleanup failed');
  for(const [route,id] of transient.reverse()){if((route==='skills'&&id===skill.id)||(route==='skill-categories'&&id===skillCategory.id))continue;const cleanup=await request(`/api/admin/${route}/${id}`,{method:'DELETE',cookie:sessionCookie,csrf:adminCsrf});assert(cleanup.status===204,`${route} cleanup failed (${cleanup.status})`);}
  const categoryCleanup=await request(`/api/admin/skill-categories/${skillCategory.id}`,{method:'DELETE',cookie:sessionCookie,csrf:adminCsrf});assert(categoryCleanup.status===204,'skill category cleanup failed');
  const logout=await request('/api/auth/logout',{method:'POST',cookie:sessionCookie,csrf:adminCsrf});assert(logout.status===204,'logout failed');
  const afterLogout=await request('/api/admin/dashboard',{cookie:sessionCookie});assert(afterLogout.status===401,'session remained authorized after logout');
  console.log('Smoke checks passed: preserved public content and image paths, admin CRUD, category safety, image upload, publication, invalid-link rejection, auth boundaries, CSRF, logout, private-field filtering, and the unconfigured-SMTP error path.');
})().catch(error=>{console.error(`Smoke check failed: ${error.message}`);process.exitCode=1;}).finally(()=>pool.end());
