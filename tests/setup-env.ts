// Loaded before any test file: deterministic env for API tests.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.RESEND_API_KEY = '';
process.env.OWNER_EMAIL = 'owner@233kitchen.test';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_EMAIL = 'admin@233kitchen.test';
process.env.ADMIN_PASSWORD = 'correct-horse-battery';
process.env.SITE_URL = 'http://localhost:5173';
