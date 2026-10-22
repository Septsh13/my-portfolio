require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const bcrypt=require('bcryptjs');
const {pool}=require('../src/config/database');
(async()=>{
  const email=String(process.env.ADMIN_BOOTSTRAP_EMAIL||'').trim().toLowerCase();
  const password=process.env.ADMIN_BOOTSTRAP_PASSWORD||'';
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Set ADMIN_BOOTSTRAP_EMAIL in backend/.env.');
  if(password.length<12||password.length>200)throw new Error('Set a strong ADMIN_BOOTSTRAP_PASSWORD of at least 12 characters.');
  const count=await pool.query('SELECT count(*)::int AS count FROM admin_users');
  if(count.rows[0].count)throw new Error('An administrator already exists; bootstrap never resets or recreates an account.');
  const hash=await bcrypt.hash(password,12);
  await pool.query('INSERT INTO admin_users(email,password_hash) VALUES($1,$2)',[email,hash]);
  console.log(`Created the initial administrator: ${email}. Remove ADMIN_BOOTSTRAP_PASSWORD from backend/.env now.`);
})().catch((error)=>{console.error(error.message);process.exitCode=1;}).finally(()=>pool.end());
