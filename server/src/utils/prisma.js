const { PrismaClient } = require('@prisma/client');
const prisma = globalThis.eventlyPrisma || new PrismaClient();
globalThis.eventlyPrisma = prisma;
module.exports = prisma;
