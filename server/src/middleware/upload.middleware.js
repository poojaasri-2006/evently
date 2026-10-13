const multer = require('multer');
const path = require('path');
const fs = require('fs');
const imageExtensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const useBlob = Boolean(process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN);
let storage = multer.memoryStorage();
if (!useBlob) {
  const uploadDir = path.join(__dirname, '../../uploads/profiles');
  fs.mkdirSync(uploadDir, { recursive: true });
  storage = multer.diskStorage({ destination: uploadDir, filename: (req, file, callback) => callback(null, 'vendor-' + req.user.id + '-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + imageExtensions[file.mimetype]) });
}
module.exports = multer({ storage, limits: { fileSize: 4 * 1024 * 1024 }, fileFilter: (req, file, callback) => imageExtensions[file.mimetype] ? callback(null, true) : callback(new Error('Only JPEG, PNG, WEBP, and GIF images are allowed'), false) });
