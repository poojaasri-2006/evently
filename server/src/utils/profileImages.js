const { put } = require('@vercel/blob');
const { requestOrigin } = require('./origins');
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const saveProfileImage = async (req, file, userId) => {
  if (!file.buffer) return requestOrigin(req) + '/uploads/profiles/' + file.filename;
  if (!process.env.BLOB_READ_WRITE_TOKEN) { const error = new Error('BLOB_READ_WRITE_TOKEN is required for profile uploads.'); error.status = 503; throw error; }
  const blob = await put('profiles/vendor-' + userId + '-' + Date.now() + extensions[file.mimetype], file.buffer, { access: 'public', addRandomSuffix: true, contentType: file.mimetype });
  return blob.url;
};
module.exports = { saveProfileImage };
