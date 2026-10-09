const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const rows = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE tablename IN ('plans', 'plan_features', 'subscriptions', 'payments')`;
    console.log('Billing tables found:');
    rows.forEach(r => console.log('  -', r.tablename));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();