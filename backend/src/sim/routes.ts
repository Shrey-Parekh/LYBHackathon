// Demo endpoints (DESIGN.md 5.5, 10.4). Registered only when DEMO_MODE=true; coordinators only.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../ctx';
import { notFound } from '../http/errors';
import { defineRoute, type RegisteredRoute } from '../http/route';
import { DemoClockRequest, DemoState, ErrorResponse } from '../http/schemas';
import type { SimulatedClock } from './clock';
import type { Simulator } from './simulator';

export function demoState(sim: Simulator, clock: SimulatedClock) {
  return {
    clock: { now: clock.nowIso(), speed: clock.speed, paused: clock.paused, mode: clock.mode },
    scenario: { id: sim.scenarioId, status: sim.status, next_pause_at: sim.nextPauseAt },
  };
}

export function registerDemoRoutes(app: FastifyInstance, ctx: Ctx, reg: RegisteredRoute[], sim: Simulator, clock: SimulatedClock) {
  const publishDemo = (kind: string) =>
    ctx.hub.publish([{ hint: { entity: 'demo', id: 'main', kinds: [kind] }, audience: { kind: 'all' } }]);

  defineRoute(app, ctx, reg, {
    method: 'POST',
    url: '/demo/reset',
    roles: ['COORDINATOR'],
    summary: 'Stop the replay, restore the seed, set the clock to 08:50 IST paused',
    responses: { 200: DemoState },
    handler: ({ user }) => {
      sim.reset(user!.id);
      return { status: 200, body: demoState(sim, clock) };
    },
  });

  defineRoute<{ id: string }>(app, ctx, reg, {
    method: 'POST',
    url: '/demo/scenarios/:id/start',
    roles: ['COORDINATOR'],
    summary: 'Start (or resume) the replay at the configured speed',
    params: z.object({ id: z.string().min(1).max(40) }),
    responses: { 200: DemoState, 404: ErrorResponse },
    handler: ({ params }) => {
      if (params.id !== ctx.fixtures.scenario.scenario_id) throw notFound('Scenario not found');
      sim.start(params.id);
      publishDemo('started');
      return { status: 200, body: demoState(sim, clock) };
    },
  });

  defineRoute<Record<string, never>, Record<string, never>, { speed?: number; paused?: boolean }>(app, ctx, reg, {
    method: 'POST',
    url: '/demo/clock',
    roles: ['COORDINATOR'],
    summary: 'Set replay speed (simulated seconds per real second) and pause or resume',
    body: DemoClockRequest,
    responses: { 200: DemoState },
    handler: ({ body }) => {
      sim.setClock(body);
      publishDemo('clock');
      return { status: 200, body: demoState(sim, clock) };
    },
  });

  defineRoute(app, ctx, reg, {
    method: 'GET',
    url: '/demo/state',
    roles: ['COORDINATOR'],
    summary: 'Clock time, speed and scenario status',
    responses: { 200: DemoState },
    handler: () => ({ status: 200, body: demoState(sim, clock) }),
  });
}
