// Builds the Fastify app with all routes. One process, one SQLite file (DESIGN.md 4).
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config';
import type { Ctx } from './ctx';
import { openDb } from './db/db';
import { ApiError, errorBody } from './http/errors';
import { buildOpenApi } from './http/openapi';
import { API_PREFIX, defineRoute, type RegisteredRoute } from './http/route';
import { Health } from './http/schemas';
import { InAppNotifier } from './notify/notifier';
import { RealClock, SimulatedClock } from './sim/clock';
import { loadFixtures } from './sim/fixtures';
import { seedDatabase } from './sim/seed';
import { Simulator } from './sim/simulator';
import { StreamHub } from './stream/hub';
import { registerAuthRoutes } from './auth/routes';
import { registerShipmentRoutes } from './shipments/routes';
import { registerAlertRoutes } from './alerts/routes';
import { registerDecisionRoutes } from './decisions/routes';
import { registerDashboardRoutes } from './dashboard/routes';
import { registerNotificationRoutes } from './notify/routes';
import { registerStreamRoutes } from './stream/routes';
import { registerDemoRoutes } from './sim/routes';
import { staleTick } from './shipments/staleTick';

export interface BuildOptions {
  config: AppConfig;
  fixturesDir?: string;
  /** Drive the simulator from a real-time timer. Tests set false and call sim.advanceTo directly. */
  autoTick?: boolean;
  logger?: boolean;
}

export interface Built {
  app: FastifyInstance;
  ctx: Ctx;
  sim: Simulator | null;
  clock: SimulatedClock | null;
  close: () => Promise<void>;
}

export async function buildApp(opts: BuildOptions): Promise<Built> {
  const { config } = opts;
  const fixtures = loadFixtures(opts.fixturesDir);
  const db = openDb(config.databaseFile);
  const simClock = config.demoMode ? new SimulatedClock(fixtures.scenario.clock_start) : null;
  const ctx: Ctx = {
    config,
    db,
    clock: simClock ?? new RealClock(),
    fixtures,
    hub: new StreamHub(),
    notifier: new InAppNotifier(),
    counterfactual: null,
  };
  const sim = simClock ? new Simulator(ctx, simClock, opts.autoTick ?? true) : null;
  ctx.counterfactual = sim;

  // Demo mode always starts from the seed; otherwise seed only an empty database.
  if (sim) sim.reset(null);
  else if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) seedDatabase(ctx, null);

  const app = Fastify({ logger: opts.logger ?? false, trustProxy: true });
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) return reply.status(err.status).send(errorBody(err.code, err.message, err.details));
    const e = err as { statusCode?: number; code?: string; message?: string };
    if (e.statusCode && e.statusCode < 500) {
      // Malformed JSON and similar client errors.
      return reply.status(422).send(errorBody('VALIDATION_FAILED', e.message ?? 'Invalid request'));
    }
    req.log.error(err);
    return reply.status(500).send(errorBody('INTERNAL_ERROR', 'Something went wrong. The change was not applied; retry.'));
  });
  app.setNotFoundHandler((_req, reply) => reply.status(404).send(errorBody('NOT_FOUND', 'Not found')));

  const reg: RegisteredRoute[] = [];
  defineRoute(app, ctx, reg, {
    method: 'GET',
    url: '/health',
    roles: 'PUBLIC',
    summary: 'Liveness',
    responses: { 200: Health },
    handler: () => ({ status: 200, body: { status: 'ok' as const, demo_mode: config.demoMode, now: ctx.clock.nowIso() } }),
  });
  registerAuthRoutes(app, ctx, reg);
  registerShipmentRoutes(app, ctx, reg);
  registerAlertRoutes(app, ctx, reg);
  registerDecisionRoutes(app, ctx, reg);
  registerDashboardRoutes(app, ctx, reg);
  registerNotificationRoutes(app, ctx, reg);
  registerStreamRoutes(app, ctx, reg);
  if (sim && simClock) registerDemoRoutes(app, ctx, reg, sim, simClock);

  const openapi = buildOpenApi(reg);
  app.get('/openapi.json', async () => openapi);
  app.get(`${API_PREFIX}/openapi.json`, async () => openapi);
  app.get('/health', async () => Health.parse({ status: 'ok', demo_mode: config.demoMode, now: ctx.clock.nowIso() }));

  // Real clock: the stale-position check runs every 5 minutes. (In demo mode the simulator runs it.)
  const timers: NodeJS.Timeout[] = [setInterval(() => ctx.hub.keepAlive(), 15_000)];
  if (!sim) timers.push(setInterval(() => staleTick(ctx), fixtures.config.demo.stale_tick_min * 60_000));

  return {
    app,
    ctx,
    sim,
    clock: simClock,
    close: async () => {
      timers.forEach(clearInterval);
      sim?.shutdown();
      await app.close();
      db.close();
    },
  };
}
