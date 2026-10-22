function requireAdmin(req, res, next) {
  if (!req.session?.adminId) return res.status(401).json({ error: 'Authentication required.' });
  next();
}

function requireCsrf(req, res, next) {
  const expected = req.session?.csrfToken;
  const supplied = req.get('x-csrf-token');
  if (!expected || !supplied || expected.length !== supplied.length) return res.status(403).json({ error: 'Invalid CSRF token.' });
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  if (mismatch !== 0) return res.status(403).json({ error: 'Invalid CSRF token.' });
  next();
}

module.exports = { requireAdmin, requireCsrf };
