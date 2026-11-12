// Truck choice for a new order (load consolidation at dispatch). Deterministic rules, no model.
//
// A new order can ride on a truck that is already planned, when all of these hold:
//   1. the truck has not left the plant (status PLANNED);
//   2. it is going to the same customer, so the route and delivery point are the same;
//   3. the vehicle has enough spare payload;
//   4. the new order is not promised earlier than the truck's own promise (the truck stays tracked against that one);
//   5. the truck's current ETA is at or before the new order's promise.
// Otherwise the order gets its own truck: the smallest free vehicle that can carry it.
// The coordinator sees every candidate with its reason and approves one; nothing is assigned automatically.
import { audit } from '../audit';
import type { AuthUser } from '../auth/policy';
import type { Ctx } from '../ctx';
import { nextSeq, type Db } from '../db/db';
import { ApiError, validationFailed } from '../http/errors';
import { LIVE_SHIPMENT_PREFIX } from '../liveRouting/scenarios';
import { customerUserIds } from '../notify/notifier';
import { recomputeEta } from '../shipments/recompute';
import { getShipment, getSnapshot, type ShipmentRow } from '../shipments/repo';
import type { PendingHint } from '../stream/hub';
import { addMinutes, istClock, minutesBetween, MIN_MS, parseIso, toIso } from '../time';

/** A new truck leaves no sooner than this after the order is placed (loading and paperwork). */
export const LOADING_LEAD_MIN = 60;
/** A new truck is planned to arrive this long before the promise. */
export const ARRIVAL_BUFFER_MIN = 60;
const NOT_FINISHED = ['PLANNED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED'];

export interface OrderInput {
  customer_id: string;
  product: string;
  quantity_t: number;
  promised_by: string;
}

export interface TruckOption {
  id: string;
  type: 'ADD_TO_TRUCK' | 'NEW_TRUCK';
  label: string;
  feasible: boolean;
  infeasible_reason: string | null;
  recommended: boolean;
  shipment_id: string | null;
  vehicle_reg: string | null;
  transporter_name: string | null;
  capacity_t: number | null;
  load_after_t: number | null;
  spare_after_t: number | null;
  planned_departure: string | null;
  eta: string | null;
  /** Minutes between the ETA and this order's promise; negative means late. */
  margin_min: number | null;
  /** ADD_TO_TRUCK only: the separate trip that is not needed, and its cost at config.options.cost_per_km_inr. */
  km_saved: number | null;
  cost_saved_inr: number | null;
}

interface Vehicle {
  registration: string;
  transporter_id: string;
  payload_capacity_t: number;
  tare_t: number;
  standby: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function vehicles(ctx: Ctx): Vehicle[] {
  return ctx.fixtures.transporters.flatMap((t) => (t.vehicles ?? []).map((v) => ({ ...v, transporter_id: t.id })));
}

const transporterName = (db: Db, id: string) => (db.prepare('SELECT name FROM transporters WHERE id = ?').get(id) as { name: string } | undefined)?.name ?? id;

/** The customer's usual road: the route to that customer that is not another route's alternative. */
function baseRoute(ctx: Ctx, customerId: string) {
  const alternatives = new Set(ctx.fixtures.alternatives.map((a) => a.alt_route_id));
  return ctx.fixtures.routes.find((r) => r.destination_customer_id === customerId && !alternatives.has(r.id));
}

function tripMinutes(route: { segments: { start_km: number; end_km: number; baseline_speed_kmph: number; dwell_after_min: number }[] }): number {
  return route.segments.reduce((sum, s) => sum + ((s.end_km - s.start_km) / s.baseline_speed_kmph) * 60 + s.dwell_after_min, 0);
}

export function validateOrder(ctx: Ctx, input: OrderInput, now: string): void {
  if (!ctx.db.prepare('SELECT 1 FROM customers WHERE id = ?').get(input.customer_id)) throw validationFailed('Unknown customer');
  if (parseIso(input.promised_by) <= parseIso(now)) throw validationFailed('The promised delivery time must be in the future');
}

function blank(id: string, type: TruckOption['type'], label: string): TruckOption {
  return {
    id, type, label, feasible: false, infeasible_reason: null, recommended: false, shipment_id: null, vehicle_reg: null, transporter_name: null,
    capacity_t: null, load_after_t: null, spare_after_t: null, planned_departure: null, eta: null, margin_min: null, km_saved: null, cost_saved_inr: null,
  };
}

function addToTruck(ctx: Ctx, s: ShipmentRow, input: OrderInput, fleet: Vehicle[]): TruckOption {
  const { db } = ctx;
  const vehicle = fleet.find((v) => v.registration === s.vehicle_reg);
  const snap = getSnapshot(db, s.current_eta_snapshot_id);
  const route = db.prepare('SELECT total_km FROM routes WHERE id = ?').get(s.planned_route_id) as { total_km: number };
  const option: TruckOption = {
    ...blank(`ADD-${s.id}`, 'ADD_TO_TRUCK', `Add to ${s.id} (${s.vehicle_reg}), already going to this customer`),
    shipment_id: s.id,
    vehicle_reg: s.vehicle_reg,
    transporter_name: transporterName(db, s.transporter_id),
    capacity_t: vehicle?.payload_capacity_t ?? null,
    planned_departure: s.planned_departure,
    eta: snap?.eta ?? null,
    margin_min: snap ? Math.round(minutesBetween(snap.eta, input.promised_by)) : null,
  };
  const spare = vehicle ? round1(vehicle.payload_capacity_t - s.quantity_t) : null;
  let reason: string | null = null;
  if (s.status !== 'PLANNED') reason = 'This truck has already left the plant';
  else if (!vehicle || spare === null) reason = `The payload capacity of ${s.vehicle_reg} is not known`;
  else if (spare < input.quantity_t) reason = `Only ${spare} t spare: a ${vehicle.payload_capacity_t} t truck already carrying ${s.quantity_t} t`;
  else if (parseIso(input.promised_by) < parseIso(s.agreed_delivery_by)) reason = `This order is promised before the truck's own promise of ${istClock(s.agreed_delivery_by)}`;
  else if (!snap) reason = 'The truck has no ETA yet';
  else if (parseIso(snap.eta) > parseIso(input.promised_by)) reason = `The truck is expected at ${istClock(snap.eta)}, after this order's promise`;
  if (reason) return { ...option, infeasible_reason: reason, spare_after_t: spare };
  return {
    ...option,
    feasible: true,
    load_after_t: round1(s.quantity_t + input.quantity_t),
    spare_after_t: round1(spare! - input.quantity_t),
    km_saved: route.total_km,
    cost_saved_inr: Math.round(route.total_km * ctx.fixtures.config.options.cost_per_km_inr),
  };
}

function newTruck(ctx: Ctx, input: OrderInput, fleet: Vehicle[], now: string): TruckOption & { plan?: { vehicle: Vehicle; route_id: string } } {
  const { db } = ctx;
  const option = blank('NEW-TRUCK', 'NEW_TRUCK', 'Send a separate truck');
  const busy = new Set(
    (db.prepare(`SELECT vehicle_reg FROM shipments WHERE status IN (${NOT_FINISHED.map(() => '?').join(',')})`).all(...NOT_FINISHED) as { vehicle_reg: string }[]).map((r) => r.vehicle_reg),
  );
  const route = baseRoute(ctx, input.customer_id);
  if (!route) return { ...option, infeasible_reason: 'No route to this customer is set up' };
  const vehicle = fleet
    .filter((v) => !v.standby && !busy.has(v.registration) && v.payload_capacity_t >= input.quantity_t)
    .sort((a, b) => a.payload_capacity_t - b.payload_capacity_t || a.registration.localeCompare(b.registration))[0];
  if (!vehicle) return { ...option, infeasible_reason: `No free vehicle can carry ${input.quantity_t} t` };
  // Leave as late as still arrives an hour early, but never sooner than the loading lead allows. Rounded up to 5 minutes.
  const latest = parseIso(input.promised_by) - (tripMinutes(route) + ARRIVAL_BUFFER_MIN) * MIN_MS;
  const earliest = parseIso(now) + LOADING_LEAD_MIN * MIN_MS;
  const departure = toIso(Math.ceil(Math.max(latest, earliest) / (5 * MIN_MS)) * 5 * MIN_MS);
  return {
    ...option,
    feasible: true,
    label: `Send a separate truck (${vehicle.registration})`,
    vehicle_reg: vehicle.registration,
    transporter_name: transporterName(db, vehicle.transporter_id),
    capacity_t: vehicle.payload_capacity_t,
    load_after_t: input.quantity_t,
    spare_after_t: round1(vehicle.payload_capacity_t - input.quantity_t),
    planned_departure: departure,
    plan: { vehicle, route_id: route.id },
  };
}

const ROLLBACK = Symbol('rollback');
/** Run fn inside a transaction that is always rolled back: the exact result of an action without doing it. */
function dryRun<T>(db: Db, fn: () => T): T {
  let out!: T;
  try {
    db.transaction(() => {
      out = fn();
      throw ROLLBACK;
    })();
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  return out;
}

function insertOrder(db: Db, input: OrderInput): string {
  const id = `ORD-${6000 + nextSeq(db, 'NEW_ORDER')}`;
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?)').run(id, input.customer_id, input.product, input.quantity_t, input.promised_by, input.promised_by);
  return id;
}

/** Creates the order on its own PLANNED shipment and computes its first ETA. Must run inside a transaction. */
function createShipment(ctx: Ctx, input: OrderInput, plan: { vehicle: Vehicle; route_id: string }, departure: string, now: string, hints: PendingHint[]) {
  const { db } = ctx;
  const orderId = insertOrder(db, input);
  const shipmentId = `SHP-${2000 + nextSeq(db, 'NEW_SHIPMENT')}`;
  db.prepare(
    `INSERT INTO shipments (id, order_id, transporter_id, driver_user_id, vehicle_reg, quantity_t, gross_t, status,
       planned_route_id, active_route_id, planned_departure, created_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, 'PLANNED', ?, ?, ?, ?)`,
  ).run(shipmentId, orderId, plan.vehicle.transporter_id, plan.vehicle.registration, input.quantity_t, round1(input.quantity_t + plan.vehicle.tare_t), plan.route_id, plan.route_id, departure, now);
  recomputeEta(ctx, shipmentId, now, null, 'EVENT', hints);
  return { orderId, shipmentId };
}

/** Every candidate truck for this order, feasible or not, and which one is recommended. */
export function planOrder(ctx: Ctx, input: OrderInput, now: string): { options: TruckOption[]; recommended_option_id: string | null; plan?: { vehicle: Vehicle; route_id: string } } {
  const { db } = ctx;
  const fleet = vehicles(ctx);
  const sameCustomer = (db
    .prepare(
      `SELECT s.id FROM shipments s JOIN orders o ON o.id = s.order_id
       WHERE o.customer_id = ? AND s.status IN ('PLANNED', 'DISPATCHED', 'IN_TRANSIT') AND s.id NOT LIKE ? ORDER BY s.planned_departure, s.id`,
    )
    .all(input.customer_id, `${LIVE_SHIPMENT_PREFIX}%`) as { id: string }[]).map((r) => getShipment(db, r.id)!);
  const adds = sameCustomer.map((s) => addToTruck(ctx, s, input, fleet));

  const { plan, ...fresh } = newTruck(ctx, input, fleet, now);
  if (plan) {
    // The ETA of a truck that does not exist yet: create it, read the engine's answer, and roll back.
    const snap = dryRun(db, () => {
      const { shipmentId } = createShipment(ctx, input, plan, fresh.planned_departure!, now, []);
      return getSnapshot(db, getShipment(db, shipmentId)!.current_eta_snapshot_id);
    });
    fresh.eta = snap?.eta ?? null;
    fresh.margin_min = snap ? Math.round(minutesBetween(snap.eta, input.promised_by)) : null;
  }

  // Sharing a truck that is already going beats a second trip; among several, the one that arrives first, then the fuller one.
  const best =
    adds.filter((o) => o.feasible).sort((a, b) => parseIso(a.eta!) - parseIso(b.eta!) || a.spare_after_t! - b.spare_after_t!)[0] ?? (fresh.feasible ? fresh : undefined);
  const options = [...adds, fresh].map((o) => ({ ...o, recommended: o.id === best?.id }));
  return { options, recommended_option_id: best?.id ?? null, plan };
}

/** The coordinator approved one option: check it still holds, then apply it. */
export function createOrder(ctx: Ctx, user: AuthUser, input: OrderInput, optionId: string) {
  const { db } = ctx;
  const now = ctx.clock.nowIso();
  validateOrder(ctx, input, now);
  const hints: PendingHint[] = [];
  const result = db.transaction(() => {
    const { options, plan } = planOrder(ctx, input, now);
    const option = options.find((o) => o.id === optionId);
    if (!option) throw validationFailed('Unknown option');
    if (!option.feasible) throw new ApiError(409, 'ORDER_PLAN_STALE', option.infeasible_reason ?? 'That truck is no longer available. Check the options again');
    let orderId: string;
    let shipmentId: string;
    if (option.type === 'ADD_TO_TRUCK') {
      shipmentId = option.shipment_id!;
      orderId = insertOrder(db, input);
      db.prepare('INSERT INTO shipment_orders (order_id, shipment_id, added_by, added_at) VALUES (?, ?, ?, ?)').run(orderId, shipmentId, user.id, now);
      // The heavier truck may no longer fit a weight-limited alternative, so option sets are invalidated too.
      db.prepare('UPDATE shipments SET quantity_t = ?, gross_t = ROUND(gross_t + ?, 1), version = version + 1, plan_version = plan_version + 1 WHERE id = ?').run(
        option.load_after_t, input.quantity_t, shipmentId,
      );
    } else {
      ({ orderId, shipmentId } = createShipment(ctx, input, plan!, option.planned_departure!, now, hints));
    }
    const s = getShipment(db, shipmentId)!;
    audit(db, now, user.id, 'ORDER_CREATED', 'order', orderId, {
      option: option.type, shipment_id: shipmentId, vehicle_reg: s.vehicle_reg, quantity_t: input.quantity_t, km_saved: option.km_saved,
    });
    for (const userId of customerUserIds(db, input.customer_id)) {
      ctx.notifier.send(db, now, {
        user_id: userId,
        shipment_id: shipmentId,
        kind: 'ORDER_CONFIRMED',
        title: `Order ${orderId} confirmed`,
        body:
          option.type === 'ADD_TO_TRUCK'
            ? `${input.quantity_t} t ${input.product} will travel with order ${s.order_id} on ${s.vehicle_reg}${option.eta ? `, expected ${istClock(option.eta)}` : ''}.`
            : `${input.quantity_t} t ${input.product} is planned on ${s.vehicle_reg}${option.eta ? `, expected ${istClock(option.eta)}` : ''}.`,
      }, hints);
    }
    hints.push({ hint: { entity: 'shipment', id: shipmentId, version: s.version, kinds: ['order'] }, audience: { kind: 'shipment', customer_id: s.customer_id, driver_user_id: s.driver_user_id } });
    return { order_id: orderId, shipment_id: shipmentId, option: { ...option, recommended: option.recommended } };
  })();
  ctx.hub.publish(hints);
  return result;
}

/** Orders added to a truck after it was planned (the truck's own order is shipments.order_id). */
export function extraOrders(db: Db, shipmentId: string) {
  return db
    .prepare(
      `SELECT o.id, o.product, o.quantity_t, o.agreed_delivery_by AS promised_by FROM shipment_orders so JOIN orders o ON o.id = so.order_id
       WHERE so.shipment_id = ? ORDER BY so.added_at, o.id`,
    )
    .all(shipmentId) as { id: string; product: string; quantity_t: number; promised_by: string }[];
}
