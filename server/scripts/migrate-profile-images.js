const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const prisma = require('../src/utils/prisma');
const { put, del } = require('@vercel/blob');
const apply = process.argv.includes('--apply');
(async () => {
  try {
    if (apply && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Set BLOB_READ_WRITE_TOKEN before applying image migration.');
    const profiles = await prisma.vendorProfile.findMany({ where: { imageUrl: { contains: '/uploads/profiles/' } }, select: { id: true, userId: true, imageUrl: true } });
    let migrated = 0, missing = 0, eligible = 0;
    for (const profile of profiles) {
      const filename = path.basename(new URL(profile.imageUrl, 'http://localhost:5000').pathname);
      if (!filename.startsWith('vendor-' + profile.userId + '-')) { missing++; continue; }
      const root = path.resolve(__dirname, '../uploads/profiles');
      const file = path.resolve(root, filename);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { missing++; continue; }
      eligible++;
      if (!apply) continue;
      const extension = path.extname(filename).toLowerCase();
      const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
      if (!types[extension]) throw new Error('Unsupported existing image extension: ' + extension);
      const blob = await put('profiles/' + filename, fs.readFileSync(file), { access: 'public', contentType: types[extension], addRandomSuffix: true });
      const result = await prisma.vendorProfile.updateMany({ where: { id: profile.id, imageUrl: profile.imageUrl }, data: { imageUrl: blob.url } });
      if (result.count) migrated++; else await del(blob.url);
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', eligible, migrated, missingOrUnrecognized: missing }));
    if (missing) console.warn('Some existing images could not be found or recognized. Re-upload those photos after deployment.');
  } finally { await prisma.$disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
