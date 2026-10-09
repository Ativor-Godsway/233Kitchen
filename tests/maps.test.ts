import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { disconnectDb } from '../server/db.js';
import { mapLinks, streetLine } from '../shared/maps.js';
import { MenuItemModel } from '../server/models/MenuItem.js';
import { SettingsModel } from '../server/models/Settings.js';
import { migrateClientUpdates } from '../server/services/migrations.js';
import { patchSettings, resetDb } from './helpers.js';
import { SITE_CSP } from '../server/securityHeaders.js';

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

  it('builds the Google Maps search link for the pickup address', () => {
    expect(mapLinks('25 Hollywood St, Worcester, MA 01610').search).toBe(
      'https://www.google.com/maps/search/?api=1&query=25+Hollywood+St,+Worcester,+MA+01610',
    );
    expect(streetLine('25 Hollywood St, Worcester, MA 01610')).toBe('25 Hollywood St');
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

  it('is public, defaults to the exact address, and is editable in admin settings', async () => {
    const cfg = await request(app).get('/api/config').expect(200);
    expect(cfg.body.settings.mapQuery).toBe('25 Hollywood St, Worcester, MA 01610');
    expect(cfg.body.settings.pickupAddressPublic).toBe('25 Hollywood St, Worcester, MA 01610');
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

  it('migrates an existing database to the new address and waakye description, idempotently', async () => {
    await patchSettings({
      pickupAddressPublic: 'Hollywood Street, Worcester, MA',
      mapQuery: 'Hollywood Street, Worcester, MA',
      pickupAddressFull: 'Hollywood Street, Worcester, MA (full address sent on confirmation)',
      businessAddressLine: '+233 Kitchen · Hollywood Street, Worcester, MA',
      businessPhone: '(555) 000-0000',
    });
    await MenuItemModel.updateOne(
      { slug: 'loaded-hajia-waakye' },
      { $set: { description: 'Waakye with talia.', basePrice: 2500 } },
    );

    const first = await migrateClientUpdates();
    expect(first).toMatchObject({ waakyeUpdated: true, settingsUpdated: true });

    const item = await MenuItemModel.findOne({ slug: 'loaded-hajia-waakye' }).lean();
    expect(item?.description).toContain('boiled eggs, spaghetti, sweet fried plantain');
    expect(item?.description).not.toMatch(/talia/i);
    expect(item?.basePrice).toBe(2500); // other admin edits are untouched
    const row = await SettingsModel.findById('global').lean();
    expect(row?.data).toMatchObject({
      pickupAddressPublic: '25 Hollywood St, Worcester, MA 01610',
      mapQuery: '25 Hollywood St, Worcester, MA 01610',
      pickupAddressFull: '25 Hollywood St, Worcester, MA 01610',
      businessAddressLine: '+233 Kitchen · 25 Hollywood St, Worcester, MA 01610',
      businessPhone: '(555) 000-0000',
    });

    const again = await migrateClientUpdates();
    expect(again).toMatchObject({ waakyeUpdated: false, settingsUpdated: false });
  });

  it('allows the Google Maps iframe in the website Content-Security-Policy', () => {
    // The page CSP is served by Vercel (vercel.json); tests/security.test.ts keeps them in sync.
    expect(SITE_CSP).toMatch(/frame-src https:\/\/www\.google\.com https:\/\/maps\.google\.com/);
    expect(new URL(mapLinks('x').embed).origin).toBe('https://www.google.com');
  });
});
