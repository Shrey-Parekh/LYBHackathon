// New orders and the truck they travel on (load consolidation at dispatch). Coordinator only.
//   GET  /orders/new    what the form needs: customers, products, the current time
//   POST /orders/plan   every candidate truck for an order, with reasons; changes nothing
//   POST /orders        the coordinator's approved choice; rechecked before it is applied
import type { FastifyInstance } from 'fastify';
import type { Ctx } from '../ctx';
import { defineRoute, type RegisteredRoute } from '../http/route';
import { ErrorResponse, NewOrderForm, OrderCreate, OrderCreated, OrderDraft, OrderPlan } from '../http/schemas';
import { createOrder, planOrder, validateOrder } from './plan';

export function registerOrderRoutes(app: FastifyInstance, ctx: Ctx, reg: RegisteredRoute[]) {
  const { db } = ctx;

  defineRoute(app, ctx, reg, {
    method: 'GET',
    url: '/orders/new',
    roles: ['COORDINATOR'],
    summary: 'Customers and products for the new-order form',
    responses: { 200: NewOrderForm },
    handler: () => {
      const alternatives = new Set(ctx.fixtures.alternatives.map((a) => a.alt_route_id));
      const customers = (db.prepare('SELECT id, name FROM customers ORDER BY id').all() as { id: string; name: string }[]).map((c) => ({
        ...c,
        deliver_to: ctx.fixtures.routes.find((r) => r.destination_customer_id === c.id && !alternatives.has(r.id))?.destination ?? null,
      }));
      const products = (db.prepare('SELECT DISTINCT product FROM orders ORDER BY product').all() as { product: string }[]).map((r) => r.product);
      return { status: 200, body: { now: ctx.clock.nowIso(), customers, products } };
    },
  });

  defineRoute<Record<string, never>, Record<string, never>, OrderDraft>(app, ctx, reg, {
    method: 'POST',
    url: '/orders/plan',
    roles: ['COORDINATOR'],
    summary: 'Candidate trucks for a new order: share a planned truck to the same customer, or send a separate one',
    body: OrderDraft,
    responses: { 200: OrderPlan, 422: ErrorResponse },
    handler: ({ body }) => {
      const now = ctx.clock.nowIso();
      validateOrder(ctx, body, now);
      const { options, recommended_option_id } = planOrder(ctx, body, now);
      return { status: 200, body: { options, recommended_option_id } };
    },
  });

  defineRoute<Record<string, never>, Record<string, never>, OrderCreate>(app, ctx, reg, {
    method: 'POST',
    url: '/orders',
    roles: ['COORDINATOR'],
    summary: 'Create the order on the truck the coordinator approved',
    body: OrderCreate,
    responses: { 201: OrderCreated, 409: ErrorResponse, 422: ErrorResponse },
    handler: ({ user, body }) => {
      const { option_id, ...order } = body;
      return { status: 201, body: createOrder(ctx, user!, order, option_id) };
    },
  });
}
