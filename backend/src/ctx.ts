// Everything a request handler or the simulator needs, created once in buildApp.
import type { AppConfig } from './config';
import type { Db } from './db/db';
import type { Clock } from './sim/clock';
import type { Fixtures } from './sim/fixtures';
import type { StreamHub } from './stream/hub';
import type { Notifier } from './notify/notifier';
import type { RouteWeather } from './weather/weather';
import type { LiveRouteDemo } from './liveRouting/demo';

/** Gives the simulated no-action arrival for a shipment (demo mode only). */
export interface CounterfactualProvider {
  noActionArrival(shipmentId: string, plannedRouteId: string): string | null;
}

export interface Ctx {
  config: AppConfig;
  db: Db;
  clock: Clock;
  fixtures: Fixtures;
  hub: StreamHub;
  notifier: Notifier;
  counterfactual: CounterfactualProvider | null;
  weather: RouteWeather;
  liveRouteDemo?: LiveRouteDemo;
}

export function shipmentNow(ctx: Ctx, shipmentId: string): string {
  return ctx.liveRouteDemo?.isLiveShipment(shipmentId) ? ctx.liveRouteDemo.now() : ctx.clock.nowIso();
}
