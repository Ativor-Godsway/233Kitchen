/**
 * Admin accounts (uses MONGODB_URI from the environment / .env):
 *
 *   npm run admin:set -- --email owner@gmail.com     create the admin, or change their password
 *   npm run admin:list                               list admins
 *   npm run admin:remove -- --email old@gmail.com    remove an admin (never the last one)
 *
 * The password is typed interactively, twice, without being shown. It is never accepted on the
 * command line (it would end up in shell history) and never printed or logged. Changing a
 * password signs that admin out everywhere.
 */
import { env } from '../env.js';
import { connectDb, disconnectDb } from '../db.js';
import {
  listAdmins,
  removeAdmin,
  setAdmin,
  validateAdminPassword,
} from '../services/adminUsers.js';
import { ask, askHidden } from './prompt.js';

function argValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  if (i >= 0) return args[i + 1];
  return args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function main() {
  const command = process.argv[2];
  if (process.argv.some((a) => /^--pass(word)?\b/.test(a))) {
    throw new Error('Never pass a password on the command line. You will be asked for it.');
  }
  if (!env.mongoUri) throw new Error('MONGODB_URI is not set.');

  if (command === 'set') {
    const email = argValue('--email');
    if (!email) throw new Error('Usage: npm run admin:set -- --email owner@gmail.com');
    await connectDb();
    let password = '';
    for (;;) {
      password = await askHidden(`New password for ${email} (min 10 characters): `);
      const problem = validateAdminPassword(password);
      if (problem) {
        console.log(problem);
        continue;
      }
      if ((await askHidden('Type it again: ')) === password) break;
      console.log('The passwords didn’t match. Try again.');
    }
    const r = await setAdmin(email, password);
    console.log(
      r.created
        ? `✓ Admin ${r.email} created. They can log in at ${env.siteUrl}/admin`
        : `✓ Password changed for ${r.email}. Their existing sessions have been signed out.`,
    );
  } else if (command === 'list') {
    await connectDb();
    const admins = await listAdmins();
    if (!admins.length) console.log('No admins yet. Add one: npm run admin:set -- --email …');
    for (const a of admins) {
      const last = a.lastLoginAt ? new Date(a.lastLoginAt).toISOString().slice(0, 16) : 'never';
      console.log(`  ${a.email.padEnd(40)} last login: ${last}`);
    }
  } else if (command === 'remove') {
    const email = argValue('--email');
    if (!email) throw new Error('Usage: npm run admin:remove -- --email old@gmail.com');
    await connectDb();
    const typed = await ask(`Remove admin ${email}? Type the email again to confirm: `);
    if (typed.toLowerCase() !== email.toLowerCase()) {
      console.log('Did not match. Nothing changed.');
    } else {
      console.log(`✓ Removed ${(await removeAdmin(email)).email}.`);
    }
  } else {
    throw new Error('Usage: npm run admin:set -- --email <email> | admin:list | admin:remove');
  }
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
