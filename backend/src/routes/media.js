const express = require('express');
const multer = require('multer');
const crypto = require('node:crypto');
const { pool } = require('../config/database');
const { requireAdmin, requireCsrf } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
function detectMime(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/)) return 'image/gif';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

router.post('/', requireAdmin, requireCsrf, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
  const mime = detectMime(req.file.buffer);
  if (!mime) return res.status(415).json({ error: 'Upload must be a valid JPEG, PNG, GIF, or WebP image.' });
  const original = String(req.file.originalname || 'image').replace(/[\\/\0-\x1f]/g, '').slice(0, 180) || 'image';
  const id = crypto.randomUUID();
  await pool.query('INSERT INTO media_assets(id,original_filename,mime_type,file_size,alt_text,data) VALUES($1,$2,$3,$4,$5,$6)', [id, original, mime, req.file.size, String(req.body.altText || '').slice(0, 300), req.file.buffer]);
  res.status(201).json({ id, url: `/api/media/${id}`, mimeType: mime, fileSize: req.file.size, originalFilename: original });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.sendStatus(404);
  const result = await pool.query('SELECT mime_type,file_size,alt_text,data FROM media_assets WHERE id=$1', [req.params.id]);
  if (!result.rows[0]) return res.sendStatus(404);
  const asset = result.rows[0];
  res.set({ 'Content-Type': asset.mime_type, 'Content-Length': String(asset.file_size), 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
  res.send(asset.data);
}));

module.exports = router;
