import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { LayoutGroup, motion } from "motion/react";
import { ArrowRight, CheckCircle, Bell } from "@phosphor-icons/react";
import { useShipments } from "../../api/queries";
import { useRoutes } from "../../api/useShipmentRoutes";
import type { RiskLevel, ShipmentSummary } from "../../api/contract";
import { Button, CrossFade, EmptyState, ErrorNote, Loading, RiskIcon, Skeleton, StatusTag } from "../../components/ui";
import { ShipmentMap, type MapMarker, type MapRoute } from "../../components/ShipmentMap";
import { RiskCell, isStale, positionText } from "../../components/ShipmentParts";
import { RISK_WORD } from "../../lib/risk";
import { clock } from "../../lib/time";
import { duration, easeOut } from "../../lib/motion";

/*
  Attention queue (DESIGN.md 7.2). A summary strip counts shipments by the API's risk level; the list
  keeps the API's order (risk score, highest first); the map shows active shipments and focuses on the
  selected row. When a risk level changes the row slides to its new place (layout animation).
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
  const count = (level: RiskLevel) => list.filter((s) => s.current_eta?.risk_level === level).length;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-figure font-semibold tracking-[-0.02em]">Attention</h1>
          <p className="mt-1 text-body text-muted">Active shipments, most at risk first. Times are IST.</p>
        </div>
      </div>

      {/* Summary strip */}
      <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-4">
        <SummaryTile label={RISK_WORD.HIGH} value={count("HIGH")} icon={<RiskIcon level="HIGH" size={18} />} tone="text-high" />
        <SummaryTile label={RISK_WORD.MEDIUM} value={count("MEDIUM")} icon={<RiskIcon level="MEDIUM" size={18} />} tone="text-medium" />
        <SummaryTile label={RISK_WORD.LOW} value={count("LOW")} icon={<CheckCircle size={18} weight="bold" aria-hidden />} tone="text-low" />
        <SummaryTile label="Open alerts" value={needs.length} icon={<Bell size={18} weight="bold" aria-hidden />} tone="text-accent" />
      </dl>

      {shipments.error && (
        <div className="mt-4">
          <ErrorNote what="shipments" error={shipments.error} onRetry={() => shipments.refetch()} loadedAt={shipments.data ? shipments.dataUpdatedAt : undefined} />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          {shipments.isPending ? (
            <QueueSkeleton />
          ) : (
            <LayoutGroup>
              <Group id="needs-h" title="Needs a decision" count={needs.length}>
                {needs.length ? <Rows rows={needs} routes={routes} selected={selected} onSelect={setSelected} /> : <EmptyState title="No shipments need attention." />}
              </Group>
              <Group id="others-h" title="Running normally" count={others.length}>
                {others.length ? <Rows rows={others} routes={routes} selected={selected} onSelect={setSelected} /> : <EmptyState title="No other active shipments." />}
              </Group>
            </LayoutGroup>
          )}
        </div>

        <div className="xl:col-span-5">
          <div className="xl:sticky xl:top-20">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-body font-semibold">Map</h2>
              {selected && (
                <button type="button" onClick={() => setSelected(null)} className="rounded-sm text-meta font-medium text-accent">
                  Show all shipments
                </button>
              )}
            </div>
            <ShipmentMap
              label="Map of active shipments. Positions are listed in the queue."
              routes={mapRoutes}
              markers={markers}
              focusRouteIds={focus ? [focus.active_route_id] : undefined}
              className="h-[360px] xl:h-[calc(100dvh-220px)] xl:min-h-[440px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <div className="border-line px-5 py-4 [&:not(:last-child)]:border-r max-sm:[&:nth-child(2)]:border-r-0 max-sm:[&:nth-child(-n+2)]:border-b">
      <dt className={`flex items-center gap-1.5 text-meta font-semibold ${tone}`}>
        {icon}
        {label}
      </dt>
      <dd className="mt-1">
        <CrossFade value={value} shift="10px">
          {(v) => <span className="tnum text-figure font-semibold text-ink">{v}</span>}
        </CrossFade>
      </dd>
    </div>
  );
}

function Group({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="pb-2 text-body font-semibold">
        {title} <span className="tnum font-normal text-muted">{count}</span>
      </h2>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">{children}</div>
    </section>
  );
}

function Rows({ rows, routes, selected, onSelect }: { rows: ShipmentSummary[]; routes: ReturnType<typeof useRoutes>; selected: string | null; onSelect: (id: string) => void }) {
  const navigate = useNavigate();
  return (
    <ul>
      {rows.map((s) => {
        const eta = s.current_eta;
        const isSel = selected === s.id;
        const late = (eta?.slack_min ?? 0) < 0;
        return (
          <motion.li
            key={s.id}
            layout="position"
            layoutId={`row-${s.id}`}
            transition={{ duration: duration.slow, ease: easeOut }}
            className={`relative border-b border-line transition-colors duration-200 last:border-0 ${isSel ? "bg-accent-soft/60" : "hover:bg-raised"}`}
          >
            {isSel && <motion.span layoutId="queue-selected" aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent" transition={{ duration: duration.base, ease: easeOut }} />}
            <div className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-3 px-5 py-4 sm:grid-cols-[124px_1fr_auto]">
              <div className="flex flex-col items-start gap-1.5">
                <RiskCell eta={eta} />
                <StatusTag status={s.status} />
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                <button type="button" onClick={() => onSelect(s.id)} aria-pressed={isSel} className="rounded-sm text-left">
                  <span className="font-mono text-lead font-semibold tracking-tight text-ink">{s.id}</span>
                  <span className="ml-2 text-body text-ink-2">{s.customer_name}</span>
                  <span className="sr-only">. Show on map</span>
                </button>
                <p className="mt-1 text-body text-ink">{eta?.headline ?? "No estimate yet."}</p>
                <p className="tnum mt-1 text-meta text-muted">{positionText({ ...s, current_eta: eta }, routes[s.active_route_id])}</p>
              </div>
              <div className="col-start-2 row-start-1 flex flex-col items-end gap-2 text-right sm:col-start-3">
                {eta && (
                  <div className="tnum leading-tight">
                    <span className="sr-only">ETA </span>
                    <CrossFade value={eta.eta}>{(v) => <span className={`text-heading font-semibold ${late ? "text-high" : "text-ink"}`}>{clock(v)}</span>}</CrossFade>
                    <span className="block text-meta text-muted">promised {clock(eta.promised_by)} IST</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {s.open_alert && (
                    <Button variant="primary" size="sm" onClick={() => navigate(`/coordinator/shipments/${s.id}#options`)}>
                      Review options
                    </Button>
                  )}
                  <Link
                    to={`/coordinator/shipments/${s.id}`}
                    aria-label={`Details for ${s.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-2 transition-[transform,border-color] duration-200 hover:translate-x-0.5 hover:border-line-strong"
                  >
                    <ArrowRight size={14} weight="bold" aria-hidden />
                  </Link>
                </div>
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
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 border-b border-line px-5 py-4 last:border-0">
            <Skeleton className="h-6 w-24" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </Loading>
  );
}
