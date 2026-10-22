import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, getCsrf, setCsrf } from '../services/api.js';
import AdminApp from './Admin.jsx';

const asset = (path) => path ? (path.startsWith('/') || /^https?:/i.test(path) ? path : `/${path.replace(/^\.\//, '')}`) : '';
const txt = (value, fallback='') => value == null || value === '' ? fallback : value;
const socialIcon = (item, url) => {
  const platform = `${url} ${typeof item === 'object' ? item.label || '' : ''}`.toLowerCase();
  if (platform.includes('linkedin')) return 'logo-linkedin';
  if (platform.includes('github')) return 'logo-github';
  if (platform.includes('instagram')) return 'logo-instagram';
  return typeof item === 'object' && item.icon ? item.icon : 'link-outline';
};

function PublicPortfolio() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState('about');
  const [selected, setSelected] = useState('All');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [contact, setContact] = useState({ name:'', email:'', subject:'', message:'', website:'' });
  const [contactStatus, setContactStatus] = useState({ busy:false, error:'', success:'' });

  useEffect(() => {
    api('/api/portfolio').then(setData).catch((e) => setError(e.message));
  }, []);

  const pages = ['about','resume','projects','contact'];
  const profile = data?.profile || {};
  const filteredProjects = useMemo(() => (data?.projects || []).filter((p) => selected === 'All' || p.categories?.some((c) => c.name === selected)), [data, selected]);

  async function submitContact(event) {
    event.preventDefault(); setContactStatus({ busy:true,error:'',success:'' });
    try { const result = await api('/api/contact', { method:'POST', body:JSON.stringify(contact) }); setContactStatus({ busy:false,error:'',success:result.message }); setContact({ name:'',email:'',subject:'',message:'',website:'' }); }
    catch (e) { setContactStatus({ busy:false,error:e.message,success:'' }); }
  }

  if (error) return <main className="public-error"><h1>Portfolio temporarily unavailable</h1><p>{error}</p><button onClick={() => location.reload()}>Try again</button></main>;
  if (!data) return <main className="public-loading" aria-live="polite">Loading portfolio…</main>;

  const social = profile.socialLinks || [];
  return <main>
    <aside className={`sidebar ${sidebarOpen ? 'active' : ''}`} data-sidebar>
      <div className="sidebar-info">
        <figure className="avatar-box"><img src={asset(profile.image)} alt={profile.imageAlt || profile.fullName || 'Profile'} width="80" /></figure>
        <div className="info-content"><h1 className="name" title={profile.fullName}>{profile.fullName}</h1><p className="title">{profile.title}</p></div>
        <button className="info_more-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><span>{sidebarOpen ? 'Hide Contacts' : 'Show Contacts'}</span><ion-icon name="chevron-down" /></button>
      </div>
      <div className="sidebar-info_more"><div className="separator" />
        <ul className="contacts-list">
          {profile.email && <Contact icon="mail-outline" title="Email"><a href={`mailto:${profile.email}`} className="contact-link">{data.contact?.displayedEmail || profile.emailDisplay || profile.email}</a></Contact>}
          {profile.phone && <Contact icon="phone-portrait-outline" title="Phone"><a href={`tel:${profile.phoneLink||profile.phone}`} className="contact-link">{data.contact?.displayedPhone || profile.phone}</a></Contact>}
          {profile.birthday && <Contact icon="calendar-outline" title="Birthday"><time dateTime={profile.birthdayDate}>{profile.birthday}</time></Contact>}
          {(data.contact?.displayedLocation || profile.location) && <Contact icon="location-outline" title="Location"><address>{data.contact?.displayedLocation || profile.location}</address></Contact>}
        </ul>
        {social.length > 0 && <><div className="separator" /><ul className="social-list">{social.map((item,i) => { const url=typeof item==='string'?item:item.url; return url ? <li className="social-item" key={item.id||url}><a href={url} className="social-link" aria-label={typeof item==='object'&&item.label?item.label:url} title={typeof item==='object'&&item.label?item.label:url} target="_blank" rel="noreferrer"><ion-icon name={socialIcon(item,url)} /></a></li> : null; })}</ul></>}
      </div>
    </aside>
    <div className="main-content">
      <nav className="navbar"><ul className="navbar-list">{pages.map((item) => <li className="navbar-item" key={item}><button className={`navbar-link ${page===item?'active':''}`} onClick={() => {setPage(item);window.scrollTo(0,0);}}>{item==='about'?'About':item[0].toUpperCase()+item.slice(1)}</button></li>)}<li className="navbar-item"><Link className="navbar-link admin-nav-link" to="/admin/login">Admin Login</Link></li></ul></nav>
      <article className={`about ${page==='about'?'active':''}`} data-page="about">
        <header><h2 className="h2 article-title">{txt(data.about.heading,'About me')}</h2></header>
        <section className="about-text">{(data.about.paragraphs||[]).map((p,i)=><p key={i}>{p}</p>)}{data.about.summary && <p>{data.about.summary}</p>}</section>
        <section className="service"><h3 className="h3 service-title">{txt(data.about.servicesTitle,"What i'm doing")}</h3>
          <ul className="service-list">{data.services.map((service)=><li className="service-item" key={service.id}><div className="service-icon-box"><img src={asset(service.image||service.icon)} alt="" width="40" /></div><div className="service-content-box"><h4 className="h4 service-item-title">{service.title}</h4><p className="service-item-text">{service.description}</p>{service.linkUrl && <a href={service.linkUrl} target="_blank" rel="noreferrer">Learn more</a>}</div></li>)}</ul>
        </section>
      </article>
      <article className={`resume ${page==='resume'?'active':''}`} data-page="resume">
        <header><h2 className="h2 article-title">Resume</h2></header>
        <Timeline title="Education" items={data.education} icon="book-outline" render={(item)=><><h4 className="h4 timeline-item-title">{item.institution}</h4><span>{item.details?.startDate||item.details?.endDate?`${item.details.startDate||''}${item.details.startDate&&item.details.endDate?' – ':''}${item.details.endDate||''}`:item.period}</span><p className="timeline-text">{item.description}</p>{item.details?.degree && <p className="timeline-text">{item.details.degree}{item.details.field?` · ${item.details.field}`:''}{item.details.grade?` · ${item.details.grade}`:''}</p>}</>} />
        <Timeline title="Experience" items={data.experience} icon="briefcase-outline" render={(item)=><><h4 className="h4 timeline-item-title">{item.organization}</h4>{item.details?.role&&<p className="timeline-text">{item.details.role}{item.details.employmentType?` · ${item.details.employmentType}`:''}</p>}<span>{item.period}</span>{item.details?.logoUrl&&<img className="experience-logo" src={asset(item.details.logoUrl)} alt="" loading="lazy"/>}{(item.content?.paragraphs||[]).map((p,i)=><p className="timeline-text" key={i}>{p}</p>)}{item.details?.responsibilities?.map((p,i)=><p className="timeline-text" key={i}>• {p}</p>)}{item.details?.technologies?.length>0&&<p className="timeline-text">Technologies: {item.details.technologies.join(', ')}</p>}{item.details?.websiteUrl&&<a href={item.details.websiteUrl} target="_blank" rel="noreferrer">Company website</a>}</>} />
        <section className="skill"><h3 className="h3 skills-title">My skills</h3><ul className="skills-list content-card">{data.skills.map((skill)=><Skill key={skill.id} item={skill} />)}</ul></section>
        <section className="skill"><h3 className="h3 skills-title">Languages</h3><ul className="skills-list content-card">{data.languages.map((language)=><Skill key={language.id} item={language} />)}</ul></section>
      </article>
      <article className={`portfolio ${page==='projects'?'active':''}`} data-page="projects">
        <header><h2 className="h2 article-title">Projects</h2></header>
        <section className="projects"><ul className="filter-list"><li className="filter-item"><button className={selected==='All'?'active':''} onClick={()=>setSelected('All')}>All</button></li>{data.categories.map(c=><li className="filter-item" key={c.id}><button className={selected===c.name?'active':''} onClick={()=>setSelected(c.name)}>{c.name}</button></li>)}</ul>
          <div className="filter-select-box"><button className="filter-select" onClick={(e)=>e.currentTarget.classList.toggle('active')}><div className="select-value">{selected}</div><div className="select-icon"><ion-icon name="chevron-down" /></div></button><ul className="select-list"><li className="select-item"><button onClick={(e)=>{setSelected('All');e.currentTarget.closest('.filter-select-box')?.querySelector('.filter-select')?.classList.remove('active')}}>All</button></li>{data.categories.map(c=><li className="select-item" key={c.id}><button onClick={(e)=>{setSelected(c.name);e.currentTarget.closest('.filter-select-box')?.querySelector('.filter-select')?.classList.remove('active')}}>{c.name}</button></li>)}</ul></div>
          <ul className="project-list">{filteredProjects.map(project=><li className="project-item active" key={project.id} data-category={project.category?.toLowerCase()}><div className="project-img-wrapper" onClick={()=>setModal(project)}><figure className="project-img"><div className="project-item-icon-box"><ion-icon name="eye-outline" /></div><img src={asset(project.image)} alt={project.name} loading="lazy" /></figure></div><h3 className="project-title">{project.name}</h3><p className="project-category">{project.categories?.map(c=>c.name).join(', ')}</p>{project.description&&<p className="project-description">{project.description}</p>}<a href={project.githubUrl||project.projectUrl} className="project-github-link" target="_blank" rel="noreferrer">Open in GitHub</a></li>)}</ul>
        </section>
      </article>
      <article className={`contact ${page==='contact'?'active':''}`} data-page="contact">
        <header><h2 className="h2 article-title">{txt(data.contact?.heading,'Contact')}</h2></header>
        <section className="contact-form"><h3 className="h3 form-title">Contact Form</h3>{data.contact?.description&&<p>{data.contact.description}</p>}{data.contact?.formEnabled===false?<p>The contact form is currently unavailable.</p>:<form className="form" onSubmit={submitContact}>
          <div className="input-wrapper"><input className="form-input" name="name" placeholder="Full name" required maxLength="120" value={contact.name} onChange={e=>setContact({...contact,name:e.target.value})}/><input className="form-input" name="email" type="email" placeholder="Email address" required maxLength="254" value={contact.email} onChange={e=>setContact({...contact,email:e.target.value})}/></div>
          <input className="form-input" name="subject" placeholder="Subject" required maxLength="200" value={contact.subject} onChange={e=>setContact({...contact,subject:e.target.value})}/><textarea className="form-input" name="message" placeholder="Your Message" required maxLength="10000" value={contact.message} onChange={e=>setContact({...contact,message:e.target.value})}/><input className="contact-honeypot" name="website" tabIndex="-1" autoComplete="off" value={contact.website} onChange={e=>setContact({...contact,website:e.target.value})}/>
          {contactStatus.error&&<p role="alert" className="form-status error">{contactStatus.error}</p>}{contactStatus.success&&<p role="status" className="form-status success">{contactStatus.success}</p>}<button className="form-btn" type="submit" disabled={contactStatus.busy}><ion-icon name="paper-plane"/><span>{contactStatus.busy?'Sending…':'Send Message'}</span></button>
        </form>}</section>
      </article>
    </div>
    {modal&&<div className="project-modal-container active" onClick={()=>setModal(null)}><div className="overlay active"/><section className="project-modal" onClick={e=>e.stopPropagation()}><button className="project-modal-close-btn" onClick={()=>setModal(null)}><ion-icon name="close-outline"/></button><div className="project-modal-img-wrapper"><img src={asset(modal.image)} alt={modal.name} className="project-modal-img"/></div></section></div>}
  </main>;
}

function Contact({icon,title,children}) { return <li className="contact-item"><div className="icon-box"><ion-icon name={icon}/></div><div className="contact-info"><p className="contact-title">{title}</p>{children}</div></li>; }
function Timeline({title,items,icon,render}) { return <section className="timeline"><div className="title-wrapper"><div className="icon-box"><ion-icon name={icon}/></div><h3 className="h3">{title}</h3></div><ol className="timeline-list">{items.map(item=><li className="timeline-item" key={item.id}>{render(item)}</li>)}</ol></section>; }
function Skill({item}) { const value=Number(item.proficiency); return <li className="skills-item"><div className="title-wrapper"><h5 className="h5">{item.name}</h5>{item.proficiency!=null&&<data value={value}>{value}%</data>}</div>{item.details?.description&&<p className="timeline-text">{item.details.description}</p>}{item.proficiency!=null&&<div className="skill-progress-bg"><div className="skill-progress-fill" style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></div>}</li>; }

function AdminLogin() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const navigate=useNavigate();
  useEffect(()=>{getCsrf().catch(e=>setError(e.message));},[]);
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{const result=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});setCsrf(result.csrfToken);navigate('/admin',{replace:true});}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <div className="admin-login-wrap"><form className="admin-login" onSubmit={submit}><Link to="/" className="admin-back">← View portfolio</Link><h1>Admin sign in</h1><p>Manage your portfolio content.</p><label>Email<input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p className="admin-error">{error}</p>}<button className="admin-primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form></div>;
}

export default function App(){return <Routes><Route path="/admin/login" element={<AdminLogin/>}/><Route path="/admin/*" element={<AdminApp/>}/><Route path="*" element={<PublicPortfolio/>}/></Routes>;}
