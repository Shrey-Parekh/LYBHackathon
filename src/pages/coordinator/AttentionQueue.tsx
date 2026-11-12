import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { LayoutGroup, motion } from "motion/react";
import { useShipments } from "../../api/queries";
import { useRoutes } from "../../api/useShipmentRoutes";
import type { ShipmentSummary } from "../../api/contract";
import { Button, Card, EmptyState, ErrorNote, Loading, Skeleton, StatusTag } from "../../components/ui";
import { ShipmentMap, type MapMarker, type MapRoute } from "../../components/ShipmentMap";
import { RiskCell, isStale, positionText } from "../../components/ShipmentParts";
import { clock } from "../../lib/time";
import { duration, easeOut } from "../../lib/motion";

/*
  Attention queue (DESIGN.md 7.2). Left: shipments in the API's order (risk score, highest first).
  Right: map of active shipments. Selecting a row focuses the map on that shipment.
  When a risk level changes the row slides to its new place (layout animation).
*/
const ACTIVE = new Set(["PLANNED", "DISPATCHED", "IN_TRANSIT", "ARRIVED"]);

export function AttentionQueue() {
  const shipments = useShipments();
  const [selected, setSelected] = useState<string | null>(null);
  const list = useMemo(() => (shipments.data ?? []).filter((s) => ACTIVE.has(s.status)), [shipments.data]);
  const needs = list.filter((s) => s.open_alert);
  const others = list.filter((s) => !s.open_alert);
  const routes = useRoutes(list.map((s) => s.active_route_id));

  const mapRoutes: MapRoute[] = list
    .filter((s) => s.last_position)
    .map((s) => routes[s.active_route_id])
    .filter((r, i, arr): r is NonNullable<typeof r> => !!r && arr.findIndex((x) => x?.id === r.id) === i)
    .map((route) => ({ route, style: "active" as const }));
  const markers: MapMarker[] = list
    .filter((s) => s.last_position)
    .map((s) => ({
      id: s.id,
      lat: s.last_position!.lat,
      lng: s.last_position!.lng,
      label: isStale(s.current_eta) ? `${s.id}, last seen ${clock(s.last_position!.occurred_at)}` : s.id,
      stale: isStale(s.current_eta),
      emphasis: s.id === selected || (!selected && !!s.open_alert),
    }));
  const focus = selected ? list.find((s) => s.id === selected) : undefined;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-figure font-semibold tracking-tight">Attention queue</h1>
        <p className="text-meta text-muted">Ordered by delay risk. Times are IST.</p>
      </div>

      {shipments.error && (
        <div className="mt-4">
          <ErrorNote what="shipments" error={shipments.error} onRetry={() => shipments.refetch()} loadedAt={shipments.data ? shipments.dataUpdatedAt : undefined} />
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-7">
          {shipments.isPending ? (
            <QueueSkeleton />
          ) : (
            <LayoutGroup>
              <Card aria-labelledby="needs-h">
                <div className="flex items-center justify-between border-b border-line px-5 py-3">
                  <h2 id="needs-h" className="text-body font-semibold">
                    Needs attention <span className="tnum font-normal text-muted">({needs.length})</span>
                  </h2>
                </div>
                {needs.length ? <Rows rows={needs} routes={routes} selected={selected} onSelect={setSelected} /> : <EmptyState title="No shipments need attention." />}
              </Card>
              <Card aria-labelledby="others-h">
                <div className="border-b border-line px-5 py-3">
                  <h2 id="others-h" className="text-body font-semibold">
                    Other active shipments <span className="tnum font-normal text-muted">({others.length})</span>
                  </h2>
                </div>
                {others.length ? <Rows rows={others} routes={routes} selected={selected} onSelect={setSelected} /> : <EmptyState title="No other active shipments." />}
              </Card>
            </LayoutGroup>
          )}
        </div>

        <div className="xl:col-span-5">
          <div className="xl:sticky xl:top-4">
            <Card aria-labelledby="map-h">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <h2 id="map-h" className="text-body font-semibold">
                  Map
                </h2>
                {selected && (
                  <button type="button" onClick={() => setSelected(null)} className="rounded-sm text-meta font-medium text-accent">
                    Show all
                  </button>
                )}
              </div>
              <div className="p-4">
                <ShipmentMap
                  label="Map of active shipments. Positions are listed in the queue."
                  routes={mapRoutes}
                  markers={markers}
                  focusRouteIds={focus ? [focus.active_route_id] : undefined}
                  className="h-[360px] xl:h-[560px]"
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Rows({ rows, routes, selected, onSelect }: { rows: ShipmentSummary[]; routes: ReturnType<typeof useRoutes>; selected: string | null; onSelect: (id: string) => void }) {
  const navigate = useNavigate();
  return (
    <ul>
      {rows.map((s) => {
        const eta = s.current_eta;
        const isSel = selected === s.id;
        return (
          <motion.li
            key={s.id}
            layout="position"
            layoutId={`row-${s.id}`}
            transition={{ duration: duration.slow, ease: easeOut }}
            className={`border-b border-line last:border-0 ${isSel ? "bg-accent-soft" : ""}`}
          >
            <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[140px_1fr_auto]">
              <div className="flex flex-col items-start gap-1.5">
                <RiskCell eta={eta} />
                <StatusTag status={s.status} />
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-1 sm:row-start-1 sm:col-start-2">
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-pressed={isSel}
                  className="rounded-sm text-left"
                >
                  <span className="text-lead font-semibold text-ink">{s.id}</span>
                  <span className="ml-2 text-body text-ink-2">{s.customer_name}</span>
                  <span className="sr-only">. Show on map</span>
                </button>
                <p className="mt-0.5 text-body text-ink">{eta?.headline ?? "No estimate yet."}</p>
                <p className="tnum mt-1 text-meta text-muted">
                  {eta ? (
                    <>
                      ETA <span className="font-semibold text-ink">{clock(eta.eta)}</span> against promise {clock(eta.promised_by)} IST.{" "}
                    </>
                  ) : null}
                  {positionText({ ...s, current_eta: eta }, routes[s.active_route_id])}
                </p>
              </div>
              <div className="row-start-1 col-start-2 flex flex-col items-end gap-2 sm:col-start-3">
                {s.open_alert ? (
                  <Button variant="primary" size="sm" onClick={() => navigate(`/coordinator/shipments/${s.id}#options`)}>
                    Review options
                  </Button>
                ) : null}
                <Link to={`/coordinator/shipments/${s.id}`} className="rounded-sm text-meta font-medium text-accent underline-offset-2 hover:underline">
                  Details<span className="sr-only"> for {s.id}</span>
                </Link>
              </div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

function QueueSkeleton() {
  return (
    <Loading label="Loading shipments">
      <Card>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 border-b border-line px-5 py-4 last:border-0">
            <Skeleton className="h-6 w-28" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </Card>
    </Loading>
  );
}
