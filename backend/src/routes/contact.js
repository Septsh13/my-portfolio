const express = require('express');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { pool } = require('../config/database');
const asyncHandler = require('../utils/async-handler');
const router=express.Router();
const limiter=rateLimit({windowMs:60*60*1000,limit:5,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many messages. Please try again later.'}});
router.post('/',limiter,asyncHandler(async(req,res)=>{
  const {name,email,subject,message,website}=req.body||{};
  if(website) return res.status(200).json({message:'Thank you. Your message was received.'});
  if(typeof name!=='string'||name.trim().length<2||name.length>120||typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof subject!=='string'||subject.trim().length<2||subject.length>200||typeof message!=='string'||message.trim().length<5||message.length>10000)return res.status(400).json({error:'Enter a valid name, email, subject, and message.'});
  const r=await pool.query('SELECT recipient_email,form_enabled FROM contact_settings WHERE id=1');const settings=r.rows[0];
  if(!settings?.form_enabled)return res.status(403).json({error:'The contact form is currently unavailable.'});
  if(!process.env.EMAIL_HOST||!process.env.EMAIL_USER||!process.env.EMAIL_PASSWORD||!process.env.EMAIL_FROM)return res.status(503).json({error:'Message delivery is not configured yet. Please contact me using the email shown on this page.'});
  const transporter=nodemailer.createTransport({host:process.env.EMAIL_HOST,port:Number(process.env.EMAIL_PORT||587),secure:String(process.env.EMAIL_SECURE)==='true',auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASSWORD}});
  try{await transporter.sendMail({from:process.env.EMAIL_FROM,to:settings.recipient_email,replyTo:email,subject:`Portfolio contact: ${subject.trim()}`,text:`From: ${name.trim()} <${email}>\n\n${message.trim()}`});}catch(error){console.error('Contact email delivery failed:',error.message);return res.status(502).json({error:'Message delivery failed. Please try again later.'});}
  res.json({message:'Your message has been sent. Thank you.'});
}));
module.exports=router;
