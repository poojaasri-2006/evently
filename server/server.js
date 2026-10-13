require('dotenv').config();
const server = require('./src/server');
if (require.main === module) {
  server.listen(process.env.PORT || 5000, () => console.log('Server running on port ' + (process.env.PORT || 5000)));
}
module.exports = server;
