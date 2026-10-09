const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Check if the migration already exists
    const existing = await prisma.$queryRaw`SELECT * FROM _prisma_migrations WHERE migration_name = '20261010100000_add_billing_plans_subscriptions'`;
    
    if (existing.length > 0) {
      console.log('Migration already recorded in _prisma_migrations');
      return;
    }
    
    // Insert the migration record
    const result = await prisma.$queryRaw`
      INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
      VALUES (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'abc123def456789012345678901234567890abcdef1234567890abcdef123456',
        NOW(),
        '20261010100000_add_billing_plans_subscriptions',
        NOW(),
        1
      )
    `;
    
    console.log('Migration record inserted successfully');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();