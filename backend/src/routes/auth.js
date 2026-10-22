const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/database');
const asyncHandler = require('../utils/async-handler');
const { requireAdmin, requireCsrf } = require('../middleware/auth');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many login attempts. Try again later.' } });
const token = () => crypto.randomBytes(32).toString('hex');

router.get('/csrf', (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = token();
  res.json({ csrfToken: req.session.csrfToken });
});

router.post('/login', loginLimiter, requireCsrf, asyncHandler(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (email.length > 254 || password.length > 200) return res.status(400).json({ error: 'Invalid email or password.' });
  const result = await pool.query('SELECT id, email, password_hash FROM admin_users WHERE email = $1', [email]);
  const user = result.rows[0];
  const valid = user && await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
  req.session.adminId = user.id;
  req.session.adminEmail = user.email;
  req.session.csrfToken = token();
  res.json({ user: { email: user.email }, csrfToken: req.session.csrfToken });
}));

router.get('/me', (req, res) => req.session?.adminId ? res.json({ user: { email: req.session.adminEmail } }) : res.status(401).json({ error: 'Authentication required.' }));
router.post('/logout', requireAdmin, requireCsrf, (req, res, next) => req.session.destroy((error) => {
  if (error) return next(error);
  res.clearCookie('portfolio.sid');
  res.status(204).end();
}));
router.post('/change-password', requireAdmin, requireCsrf, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 200) return res.status(400).json({ error: 'New password must be between 12 and 200 characters.' });
  const found = await pool.query('SELECT password_hash FROM admin_users WHERE id = $1', [req.session.adminId]);
  if (!found.rows[0] || !(await bcrypt.compare(String(currentPassword || ''), found.rows[0].password_hash))) return res.status(401).json({ error: 'Current password is incorrect.' });
  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE admin_users SET password_hash=$1, updated_at=now() WHERE id=$2', [hash, req.session.adminId]);
  res.json({ message: 'Password changed.' });
}));

module.exports = router;
