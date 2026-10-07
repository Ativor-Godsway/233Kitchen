/**
 * npm run email:test                 → sends a test email to OWNER_EMAIL
 * npm run email:test -- you@x.com    → sends it to that address instead
 */
import { env } from '../env.js';
import { describeEmailConfig, providerStatus, sendTestEmail } from '../services/emailService.js';

async function main() {
  const to = process.argv[2] || env.ownerEmail || env.adminEmail;
  const { provider } = providerStatus();
  console.log(describeEmailConfig());
  console.log(`Sending test to: ${to}`);
  if (provider === 'dev')
    console.log('(dev mode — the email is only previewed in ./.email-previews, not sent)');
  const res = await sendTestEmail(to);
  console.log('Result:', res);
}

main().catch((err) => {
  console.error('Test email failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
