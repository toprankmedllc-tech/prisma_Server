const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const rows = await prisma.$queryRaw`SELECT * FROM _prisma_migrations`;
    console.log('Applied migrations:');
    rows.forEach(r => console.log('  -', JSON.stringify(r)));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();