import { Link } from "react-router";
import { CaretRight } from "@phosphor-icons/react";
import { useShipments } from "../../api/queries";
import { EmptyState, ErrorNote, Loading, RiskBadge, Skeleton, StatusTag } from "../../components/ui";
import { clock, clockTz } from "../../lib/time";
import { useSession } from "../../auth/session";

/* Customer: my deliveries (DESIGN.md 7.4). Sparse and reassuring: status, ETA with window, risk word, reason. */
export function MyDeliveries() {
  const session = useSession();
  const shipments = useShipments();
  const active = (shipments.data ?? []).filter((s) => s.status !== "CANCELLED");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-figure font-semibold tracking-tight">My deliveries</h1>
      <p className="mt-1 text-body text-muted">{session?.user.name}. Times are IST.</p>

      {shipments.error && (
        <div className="mt-5">
          <ErrorNote what="your deliveries" error={shipments.error} onRetry={() => shipments.refetch()} loadedAt={shipments.data ? shipments.dataUpdatedAt : undefined} />
        </div>
      )}

      <div className="mt-6 space-y-4">
        {shipments.isPending ? (
          <Loading label="Loading your deliveries">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-4 h-40 rounded-lg" />
            ))}
          </Loading>
        ) : !active.length && !shipments.error ? (
          <div className="rounded-lg border border-line bg-surface">
            <EmptyState title="No active deliveries." />
          </div>
        ) : (
          active.map((s) => {
            const eta = s.current_eta;
            return (
              <Link
                key={s.id}
                to={`/customer/shipments/${s.id}`}
                className="block rounded-lg border border-line bg-surface p-5 transition-colors duration-150 hover:border-line-strong"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lead font-semibold">Order {s.order_id}</p>
                    <p className="text-body text-ink-2">{s.destination_name}</p>
                  </div>
                  {eta && <RiskBadge level={eta.risk_level} size="lg" />}
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-2">
                  <div>
                    <p className="text-meta text-muted">Expected delivery</p>
                    <p className="tnum text-figure font-semibold">
                      {eta ? clock(eta.eta) : "—"} <span className="text-lead font-medium text-muted">IST</span>
                    </p>
                    {eta && (
                      <p className="tnum text-meta text-ink-2">
                        Likely between {clock(eta.eta_window.earliest)} and {clockTz(eta.eta_window.latest)}
                      </p>
                    )}
                  </div>
                  <StatusTag status={s.status} />
                </div>
                {eta && <p className="mt-3 text-body text-ink">{eta.headline}</p>}
                <p className="mt-3 inline-flex items-center gap-1 text-meta font-medium text-accent">
                  Track this delivery <CaretRight size={12} weight="bold" aria-hidden />
                </p>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
