import { app } from './app.js';
import { connectDb } from './db.js';

const port = Number(process.env.API_PORT || 3001);

// Listen immediately so the proxy never sees ECONNREFUSED; the DB connects in the
// background and each /api request waits for it (see the connectDb middleware in app.ts).
app.listen(port, () => console.log(`  🍲 +233 Kitchen API on http://localhost:${port}/api`));

connectDb().catch((err) => {
  // Not fatal: the next request retries the connection and gets a 503 if it still fails.
  console.error('Database connection failed (will retry on next request):', err);
});
