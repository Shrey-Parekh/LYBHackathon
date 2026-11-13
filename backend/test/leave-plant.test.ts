// "Leave the plant": the assigned driver takes a planned trip straight to IN_TRANSIT.
// On the real seed at 08:50: SHP-1003 is PLANNED for driver 3; driver 1 is on the road with SHP-1001
// and also has SHP-1004 planned.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REAL_FIXTURES_DIR } from '../src/sim/fixtures';
import { COORD, DRIVER1, makeApp, uuid, type TestApp } from './helpers';

const DRIVER3 = 'USR-DRV-03';
const leave = () => ({ event_id: uuid(), type: 'MILESTONE', payload: { to_status: 'IN_TRANSIT' } });

describe('driver leaves the plant', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await makeApp({}, REAL_FIXTURES_DIR);
  });
  afterEach(() => t.close());

  it('a planned trip goes to IN_TRANSIT, the dispatch is recorded with it, and plant and customer are told', async () => {
    const d3 = await t.login(DRIVER3);
    expect((await t.req('GET', '/shipments/SHP-1003', d3)).body.status).toBe('PLANNED');
    const res = await t.req('POST', '/shipments/SHP-1003/events', d3, leave());
    expect(res.status).toBe(201);
    expect(res.body.apply_status).toBe('APPLIED');

    const s = (await t.req('GET', '/shipments/SHP-1003', d3)).body;
    expect(s.status).toBe('IN_TRANSIT');
    // Left at the demo clock's 08:50; every stage is in the history, in order.
    expect(s.milestones.map((m: any) => [m.status, m.at])).toEqual([
      ['PLANNED', s.milestones[0].at],
      ['DISPATCHED', '2026-11-16T03:20:00Z'],
      ['IN_TRANSIT', '2026-11-16T03:20:00Z'],
    ]);
    // The ETA no longer waits for the planned 10:30 departure.
    expect(s.current_eta.factors.some((f: any) => f.code === 'DEPARTURE_WAIT')).toBe(false);

    for (const who of [COORD, 'USR-CUST-03']) {
      const note = (await t.req('GET', '/notifications', await t.login(who))).body.find((n: any) => n.kind === 'DEPARTED');
      expect(note, who).toMatchObject({ shipment_id: 'SHP-1003', title: 'ORD-5003 has left the plant' });
      expect(note.body).toContain('left at 08:50 IST');
    }
    // Tapping twice is harmless.
    expect((await t.req('POST', '/shipments/SHP-1003/events', d3, leave())).body.apply_status).toBe('DUPLICATE');
  });

  it('a driver cannot leave on a second trip while one is on the road', async () => {
    const d1 = await t.login(DRIVER1);
    const res = await t.req('POST', '/shipments/SHP-1004/events', d1, leave());
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'TRIP_IN_PROGRESS', message: 'Finish SHP-1001 before leaving on another trip' });
    expect((await t.req('GET', '/shipments/SHP-1004', d1)).body.status).toBe('PLANNED');
  });

  it('only the assigned driver can do it', async () => {
    expect((await t.req('POST', '/shipments/SHP-1003/events', await t.login(DRIVER1), leave())).status).toBe(403);
    expect((await t.req('POST', '/shipments/SHP-1003/events', await t.login(COORD), leave())).status).toBe(403);
    expect((await t.req('GET', '/shipments/SHP-1003', await t.login(COORD))).body.status).toBe('PLANNED');
  });
});
