const { execSync } = require('child_process');

// Run the migration with yes piped to it
const command = 'yes | npx prisma migrate dev --name add_billing_plans_subscriptions --skip-seed';

try {
  const output = execSync(command, {
    cwd: '/home/irfanyousuf/code/USMLE/server',
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: 120000
  });
  console.log(output);
} catch (error) {
  console.error('Error:', error.message);
  if (error.stdout) console.log('stdout:', error.stdout);
  if (error.stderr) console.log('stderr:', error.stderr);
}