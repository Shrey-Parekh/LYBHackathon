import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { useShipments } from "../../api/queries";
import { useRoutes } from "../../api/useShipmentRoutes";
import type { ShipmentSummary } from "../../api/contract";
import { CrossFade, EmptyState, ErrorNote, Loading, RiskBadge, Skeleton, StatusTag } from "../../components/ui";
import { JourneyBar } from "../../components/ShipmentParts";
import { clock, clockTz } from "../../lib/time";
import { useSession } from "../../auth/session";

/*
  Customer: my deliveries (DESIGN.md 7.4). Orders still to arrive come first, as cards with the time,
  the window and the reason. Delivered orders collapse to a short list: they have no estimate to show.
*/
const DONE = new Set(["DELIVERED", "CANCELLED"]);

export function MyDeliveries() {
  const session = useSession();
  const shipments = useShipments();
  const all = (shipments.data ?? []).filter((s) => s.status !== "CANCELLED");
  const open = all
    .filter((s) => !DONE.has(s.status))
    .sort((a, b) => (a.current_eta?.eta ?? "~").localeCompare(b.current_eta?.eta ?? "~"));
  const delivered = all.filter((s) => s.status === "DELIVERED");
  const routes = useRoutes(open.map((s) => s.active_route_id));
  const company = all[0]?.customer_name;
  const [showAll, setShowAll] = useState(false);
  const moving = open.filter((s) => s.status === "IN_TRANSIT" || s.status === "ARRIVED").length;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:py-10">
      <h1 className="text-figure font-[750] tracking-[-0.025em]">Your deliveries</h1>
      <p className="mt-1 text-body text-muted">
        {session?.user.name}
        {company ? `, ${company}` : ""}. Times are IST.
      </p>

      {shipments.error && (
        <div className="mt-5">
          <ErrorNote what="your deliveries" error={shipments.error} onRetry={() => shipments.refetch()} loadedAt={shipments.data ? shipments.dataUpdatedAt : undefined} />
        </div>
      )}

      {shipments.isPending ? (
        <Loading label="Loading your deliveries">
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-60 rounded-lg" />
            ))}
          </div>
        </Loading>
      ) : !all.length && !shipments.error ? (
        <div className="mt-8 rounded-lg border border-line bg-surface">
          <EmptyState title="No deliveries yet.">New orders appear here as soon as Plant X plans them.</EmptyState>
        </div>
      ) : (
        <>
          <section aria-labelledby="open-h" className="mt-8">
            <h2 id="open-h" className="text-lead font-semibold">
              Coming to you{" "}
              <span className="font-normal text-muted">
                {open.length} {open.length === 1 ? "order" : "orders"}
                {moving ? `, ${moving} on the road` : ""}
              </span>
            </h2>
            {open.length ? (
              <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                {open.map((s) => (
                  <li key={s.id}>
                    <DeliveryCard s={s} route={routes[s.active_route_id]} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-body text-muted">Nothing on the way right now.</p>
            )}
          </section>

          {delivered.length > 0 && (
            <section aria-labelledby="done-h" className="mt-10">
              <h2 id="done-h" className="text-lead font-semibold">
                Delivered <span className="font-normal text-muted">{delivered.length}</span>
              </h2>
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {(showAll ? delivered : delivered.slice(0, 5)).map((s) => (
                  <li key={s.id}>
                    <Link to={`/customer/shipments/${s.id}`} className="ct-go flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors duration-150 hover:bg-raised">
                      <CheckCircle size={18} weight="bold" aria-hidden className="text-low" />
                      <span className="text-body font-semibold">Order {s.order_id}</span>
                      <span className="min-w-0 flex-1 truncate text-body text-ink-2">{s.destination_name}</span>
                      <span className="inline-flex items-center gap-1 text-meta font-semibold text-accent-ink">
                        Details <ArrowRight size={13} weight="bold" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {delivered.length > 5 && (
                <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="mt-3 text-body font-semibold text-accent-ink hover:underline">
                  {showAll ? "Show the latest 5" : `Show all ${delivered.length} delivered orders`}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DeliveryCard({ s, route }: { s: ShipmentSummary; route: ReturnType<typeof useRoutes>[string] }) {
  const eta = s.current_eta;
  return (
    <Link to={`/customer/shipments/${s.id}`} className="flex h-full flex-col rounded-lg border border-line bg-surface p-5 transition-colors duration-150 hover:border-ink sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-meta text-muted">Order {s.order_id}</p>
          <p className="mt-0.5 truncate text-body font-medium text-ink">{s.destination_name}</p>
        </div>
        {eta && <RiskBadge level={eta.risk_level} />}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div>
          <p className="text-meta text-muted">Expected{s.status === "IN_TRANSIT" && eta ? `, ${Math.round(eta.remaining_km)} km away` : ""}</p>
          <p className="tnum leading-none">
            <CrossFade value={eta?.eta ?? ""}>{(v) => <span className="wide text-[2.25rem] font-[800] tracking-[-0.03em]">{v ? clock(v) : "Not yet"}</span>}</CrossFade>
          </p>
        </div>
        {eta && <p className="tnum pb-1 text-meta text-ink-2">between {clock(eta.eta_window.earliest)} and {clockTz(eta.eta_window.latest)}</p>}
      </div>

      <div className="mb-5 mt-5">
        <JourneyBar from={route?.origin ?? "Plant X"} to={s.destination_name} progressKm={s.last_position?.progress_km ?? null} totalKm={route?.total_km ?? null} status={s.status} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="min-w-0 text-body text-ink">{!eta ? "The arrival time appears once the truck is planned." : eta.headline === "On schedule" ? "No delays reported." : eta.headline}</p>
        <StatusTag status={s.status} />
      </div>
    </Link>
  );
}
