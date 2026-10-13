const configuredOrigins = () => (process.env.CLIENT_URL || (!process.env.VERCEL ? 'http://localhost:5173' : '')).split(',').map(value => value.trim()).filter(Boolean);
const requestOrigin = req => (process.env.VERCEL ? 'https' : req.protocol || 'http') + '://' + req.headers.host;
const isAllowedOrigin = (origin, req) => !origin || configuredOrigins().includes(origin) || origin === requestOrigin(req);
module.exports = { requestOrigin, isAllowedOrigin };
