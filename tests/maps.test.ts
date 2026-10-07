import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { disconnectDb } from '../server/db.js';
import { mapLinks } from '../shared/maps.js';
import { resetDb } from './helpers.js';

describe('mapLinks', () => {
  it('builds Google embed, Google directions and Apple Maps URLs', () => {
    const l = mapLinks('Hollywood Street, Worcester, MA');
    expect(l.embed).toBe(
      'https://www.google.com/maps?q=Hollywood%20Street%2C%20Worcester%2C%20MA&output=embed',
    );
    expect(l.directions).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Hollywood%20Street%2C%20Worcester%2C%20MA',
    );
    expect(l.apple).toBe('https://maps.apple.com/?daddr=Hollywood%20Street%2C%20Worcester%2C%20MA');
  });

  it('encodes characters that would break the URL', () => {
    expect(mapLinks(' 12 Main St #2 & Co ').directions).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=12%20Main%20St%20%232%20%26%20Co',
    );
  });
});

describe('mapQuery setting', () => {
  beforeEach(resetDb);
  afterAll(disconnectDb);

  async function login() {
    const agent = request.agent(app);
    await agent
      .post('/api/admin/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
      .expect(200);
    return agent;
  }

  it('is public, defaults to the street only, and is editable in admin settings', async () => {
    const cfg = await request(app).get('/api/config').expect(200);
    expect(cfg.body.settings.mapQuery).toBe('Hollywood Street, Worcester, MA');
    expect(cfg.body.settings.pickupAddressFull).toBeUndefined();

    const a = await login();
    const { settings } = (await a.get('/api/admin/settings').expect(200)).body;
    await a
      .put('/api/admin/settings')
      .send({ ...settings, mapQuery: 'x' })
      .expect(400);
    await a
      .put('/api/admin/settings')
      .send({ ...settings, mapQuery: 'Hollywood St & May St, Worcester, MA' })
      .expect(200);
    const after = await request(app).get('/api/config').expect(200);
    expect(after.body.settings.mapQuery).toBe('Hollywood St & May St, Worcester, MA');
  });

  it('allows the Google Maps iframe in the Content-Security-Policy', async () => {
    const res = await request(app).get('/api/health').expect(200);
    const csp = String(res.headers['content-security-policy']);
    expect(csp).toMatch(/frame-src 'self' https:\/\/www\.google\.com https:\/\/maps\.google\.com/);
    expect(csp).toMatch(/child-src 'self' https:\/\/www\.google\.com/);
  });
});
