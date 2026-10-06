import { app } from './app.js';
import { connectDb } from './db.js';

const port = Number(process.env.API_PORT || 3001);

connectDb()
  .then(() => {
    app.listen(port, () => console.log(`  🍲 +233 Kitchen API on http://localhost:${port}/api`));
  })
  .catch((err) => {
    console.error('Failed to start API:', err);
    process.exit(1);
  });
