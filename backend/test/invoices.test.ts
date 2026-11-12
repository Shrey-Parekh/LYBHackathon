// Invoice upload and download: who may do what, what counts as a PDF, and that a reset clears it.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_INVOICE_BYTES, safeFilename } from '../src/invoices/routes';
import { REAL_FIXTURES_DIR } from '../src/sim/fixtures';
import { COORD, CUST1, DRIVER1, makeApp, type TestApp } from './helpers';

const PDF = Buffer.from('%PDF-1.4\n% fictional test invoice\n%%EOF\n', 'latin1');
const OTHER_CUSTOMER = 'USR-CUST-03'; // Godavari Flexipack; SHP-1001 belongs to Deccan Mouldings

describe('invoices', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await makeApp({}, REAL_FIXTURES_DIR);
  });
  afterEach(() => t.close());

  const upload = async (userId: string, shipmentId: string, body: Buffer | string, filename = 'INV-5001.pdf', contentType = 'application/pdf') =>
    t.app.inject({
      method: 'POST',
      url: `/api/v1/shipments/${shipmentId}/invoice?filename=${encodeURIComponent(filename)}`,
      headers: { authorization: `Bearer ${await t.login(userId)}`, 'content-type': contentType },
      payload: body,
    });
  const download = async (userId: string, shipmentId: string) =>
    t.app.inject({ method: 'GET', url: `/api/v1/shipments/${shipmentId}/invoice`, headers: { authorization: `Bearer ${await t.login(userId)}` } });

  it('coordinator uploads; the customer is told, sees it on the shipment and downloads the same bytes', async () => {
    const cust = await t.login(CUST1);
    expect((await t.req('GET', '/shipments/SHP-1001', cust)).body.invoice).toBeNull();
    expect((await download(CUST1, 'SHP-1001')).statusCode).toBe(404);

    const up = await upload(COORD, 'SHP-1001', PDF);
    expect(up.statusCode).toBe(201);
    expect(up.json()).toEqual({ filename: 'INV-5001.pdf', size_bytes: PDF.length, uploaded_at: '2026-11-16T03:20:00Z', uploaded_by_name: 'Meera Kulkarni' });

    expect((await t.req('GET', '/shipments/SHP-1001', cust)).body.invoice).toMatchObject({ filename: 'INV-5001.pdf', size_bytes: PDF.length });
    const note = (await t.req('GET', '/notifications', cust)).body.find((n: any) => n.kind === 'INVOICE_READY');
    expect(note).toMatchObject({ shipment_id: 'SHP-1001', title: 'Invoice ready for order ORD-5001' });

    const got = await download(CUST1, 'SHP-1001');
    expect(got.statusCode).toBe(200);
    expect(got.headers['content-type']).toBe('application/pdf');
    expect(got.headers['content-disposition']).toBe('attachment; filename="INV-5001.pdf"');
    expect(got.rawPayload.equals(PDF)).toBe(true);
    expect((await download(COORD, 'SHP-1001')).rawPayload.equals(PDF)).toBe(true);
  });

  it('only a coordinator uploads; other customers and drivers cannot download or see it', async () => {
    expect((await upload(CUST1, 'SHP-1001', PDF)).statusCode).toBe(403);
    expect((await upload(DRIVER1, 'SHP-1001', PDF)).statusCode).toBe(403);
    expect((await upload(COORD, 'SHP-1001', PDF)).statusCode).toBe(201);
    expect((await download(OTHER_CUSTOMER, 'SHP-1001')).statusCode).toBe(404); // not their shipment
    expect((await download(DRIVER1, 'SHP-1001')).statusCode).toBe(403);
    expect((await t.req('GET', '/shipments/SHP-1001', await t.login(DRIVER1))).body).not.toHaveProperty('invoice');
    expect((await t.app.inject({ method: 'GET', url: '/api/v1/shipments/SHP-1001/invoice' })).statusCode).toBe(401);
    expect((await upload(COORD, 'SHP-NOPE', PDF)).statusCode).toBe(404);
  });

  it('refuses anything that is not a PDF of at most 2 MB, and cleans the file name', async () => {
    expect((await upload(COORD, 'SHP-1001', Buffer.from('MZ not a pdf'))).json().error.message).toBe('That file is not a PDF');
    expect((await upload(COORD, 'SHP-1001', '{"a":1}', 'x.pdf', 'application/json')).statusCode).toBe(422);
    const big = Buffer.concat([PDF, Buffer.alloc(MAX_INVOICE_BYTES)]);
    expect((await upload(COORD, 'SHP-1001', big)).statusCode).toBe(422);
    expect((await t.req('GET', '/shipments/SHP-1001', await t.login(COORD))).body.invoice).toBeNull();

    expect(safeFilename('C:\\Users\\me\\..\\INV 5001 (final).PDF')).toBe('INV 5001 (final).pdf');
    expect(safeFilename('../../etc/passwd')).toBe('passwd.pdf');
    expect(safeFilename('a"b\r\nc.pdf')).toBe('a_b__c.pdf');
    expect(safeFilename('///')).toBe('invoice.pdf');
  });

  it('a second upload replaces the first, and a demo reset removes it', async () => {
    const second = Buffer.concat([PDF, Buffer.from('% corrected\n')]);
    await upload(COORD, 'SHP-1001', PDF);
    expect((await upload(COORD, 'SHP-1001', second, 'INV-5001-rev1.pdf')).json().filename).toBe('INV-5001-rev1.pdf');
    expect((await download(CUST1, 'SHP-1001')).rawPayload.equals(second)).toBe(true);
    const notes = (await t.req('GET', '/notifications', await t.login(CUST1))).body.filter((n: any) => n.kind === 'INVOICE_READY');
    expect(notes.map((n: any) => n.title).sort()).toEqual(['Invoice ready for order ORD-5001', 'Invoice updated for order ORD-5001']);

    expect((await t.req('POST', '/demo/reset', await t.login(COORD))).status).toBe(200);
    expect((await download(CUST1, 'SHP-1001')).statusCode).toBe(404);
  });
});
