import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, CaretDown, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useShipments } from "../../api/queries";
import { useRoutes } from "../../api/useShipmentRoutes";
import type { ShipmentSummary } from "../../api/contract";
import { CrossFade, EmptyState, ErrorNote, Loading, RiskBadge, Skeleton, StatusTag } from "../../components/ui";
import { JourneyBar } from "../../components/ShipmentParts";
import { clock, clockTz, dateTimeTz, duration as fmtDuration } from "../../lib/time";
import { duration, easeOut } from "../../lib/motion";
import { useSession } from "../../auth/session";

/*
  Customer: my deliveries (DESIGN.md 7.4). Sparse and reassuring: when it arrives, how sure we are, where it is, why.
  Deliveries still on their way get a full card. Finished ones have no ETA to show, so they are listed
  compactly under "Past deliveries" (closed by default) with when they arrived and whether that was on time.
*/

/** Minutes late against the original promise; 0 or less is on time. null when the arrival time is unknown. */
export function lateMinutes(s: Pick<ShipmentSummary, "arrived_at" | "original_promised_by">): number | null {
  if (!s.arrived_at || !s.original_promised_by) return null;
  return Math.round((Date.parse(s.arrived_at) - Date.parse(s.original_promised_by)) / 60_000);
}

export function MyDeliveries() {
  const session = useSession();
  const shipments = useShipments();
  const all = (shipments.data ?? []).filter((s) => s.status !== "CANCELLED");
  const active = all.filter((s) => s.status !== "DELIVERED");
  // Most recent first.
  const past = all.filter((s) => s.status === "DELIVERED").sort((a, b) => (b.arrived_at ?? "").localeCompare(a.arrived_at ?? ""));
  const routes = useRoutes(active.map((s) => s.active_route_id));
  const company = all[0]?.customer_name;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <h1 className="text-figure font-semibold tracking-[-0.02em]">Your deliveries</h1>
      <p className="mt-1 text-body text-muted">
        {session?.user.name}
        {company ? `, ${company}` : ""}. Times are IST.
      </p>

      {shipments.error && (
        <div className="mt-5">
          <ErrorNote what="your deliveries" error={shipments.error} onRetry={() => shipments.refetch()} loadedAt={shipments.data ? shipments.dataUpdatedAt : undefined} />
        </div>
      )}

      <div className="mt-8 space-y-4">
        {shipments.isPending ? (
          <Loading label="Loading your deliveries">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-4 h-56 rounded-lg" />
            ))}
          </Loading>
        ) : !active.length && !shipments.error ? (
          <div className="rounded-lg border border-line bg-surface">
            <EmptyState title="No active deliveries.">New orders appear here as soon as Plant X plans them.</EmptyState>
          </div>
        ) : (
          active.map((s, i) => {
            const eta = s.current_eta;
            const route = routes[s.active_route_id];
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.slow, ease: easeOut, delay: i * 0.08 }}>
                <Link
                  to={`/customer/shipments/${s.id}`}
                  className="group block rounded-lg border border-line bg-surface p-5 transition-[border-color,transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-strong hover:bg-raised sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-meta text-muted">Order {s.order_id}</p>
                      <p className="mt-2 text-meta text-muted">Expected delivery</p>
                      <p className="tnum leading-none">
                        <CrossFade value={eta?.eta ?? ""}>{(v) => <span className="text-[2.5rem] font-semibold tracking-[-0.03em]">{v ? clock(v) : "—"}</span>}</CrossFade>
                        <span className="ml-1.5 text-lead font-medium text-muted">IST</span>
                      </p>
                      {eta && (
                        <p className="tnum mt-1.5 text-meta text-ink-2">
                          Likely between {clock(eta.eta_window.earliest)} and {clockTz(eta.eta_window.latest)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {eta && <RiskBadge level={eta.risk_level} size="lg" />}
                      <StatusTag status={s.status} />
                    </div>
                  </div>
                  <div className="mt-5">
                    <JourneyBar from={route?.origin ?? "Plant X"} to={s.destination_name} progressKm={s.last_position?.progress_km ?? null} totalKm={route?.total_km ?? null} status={s.status} />
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-4 border-t border-line pt-4">
                    <p className="text-body text-ink">{eta?.headline ?? "No estimate yet."}</p>
                    <span className="inline-flex shrink-0 items-center gap-1 text-meta font-semibold text-accent">
                      Track
                      <ArrowRight size={14} weight="bold" aria-hidden className="transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })
        )}
      </div>

      {past.length > 0 && <PastDeliveries past={past} />}
    </div>
  );
}

function PastDeliveries({ past }: { past: ShipmentSummary[] }) {
  const onTime = past.filter((s) => (lateMinutes(s) ?? 0) <= 0).length;
  return (
    <details className="group mt-8 rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="text-lead font-semibold text-ink">Past deliveries</span>
          <span className="tnum ml-2 text-meta text-muted">
            {past.length} delivered · {onTime} on time
          </span>
        </span>
        <CaretDown size={16} weight="bold" aria-hidden className="shrink-0 text-ink-2 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <ul className="divide-y divide-line border-t border-line">
        {past.map((s) => {
          const late = lateMinutes(s);
          return (
            <li key={s.id}>
              <Link to={`/customer/shipments/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-sunken">
                <span className="w-28 shrink-0 text-body font-medium text-ink">{s.order_id}</span>
                <span className="tnum min-w-0 flex-1 text-body text-ink-2">{s.arrived_at ? `Delivered ${dateTimeTz(s.arrived_at)}` : "Delivered"}</span>
                {late !== null &&
                  (late <= 0 ? (
                    <span className="inline-flex items-center gap-1 text-meta font-semibold text-low">
                      <CheckCircle size={16} weight="bold" aria-hidden /> On time
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-meta font-semibold text-medium">
                      <WarningCircle size={16} weight="bold" aria-hidden /> {fmtDuration(late)} late
                    </span>
                  ))}
                <ArrowRight size={14} weight="bold" aria-hidden className="shrink-0 text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
