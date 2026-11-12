import { Link, useParams } from "react-router";
import { ArrowLeft } from "@phosphor-icons/react";
import { useEtaHistory, useNotifications, useShipment } from "../../api/queries";
import { useRoutes } from "../../api/useShipmentRoutes";
import { ApiError } from "../../api/client";
import { Card, CardHeader, EmptyState, ErrorNote, KeyValue, Loading, Skeleton, StatusTag } from "../../components/ui";
import { EtaPanel } from "../../components/EtaPanel";
import { ShipmentMap } from "../../components/ShipmentMap";
import { JourneyBar, MilestoneTimeline, positionText, shipmentLayers } from "../../components/ShipmentParts";
import { clockTz, dateTimeTz } from "../../lib/time";

/*
  Customer delivery detail (DESIGN.md 7.4): map, milestones, "Why this ETA" in plain words and the
  notification history. Shows the transporter and vehicle, never the driver's personal details.
*/
export function DeliveryDetail() {
  const { id } = useParams();
  const shipment = useShipment(id);
  const history = useEtaHistory(id);
  const notes = useNotifications();
  const s = shipment.data;
  const routes = useRoutes([s?.active_route_id, s?.planned_route_id]);

  if (shipment.isPending) {
    return (
      <Loading label="Loading delivery">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </Loading>
    );
  }
  if (!s) {
    const notFound = shipment.error instanceof ApiError && shipment.error.status === 404;
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {notFound ? (
          <EmptyState title="We could not find that delivery.">
            <Link to="/customer" className="text-accent underline">
              Back to my deliveries
            </Link>
          </EmptyState>
        ) : (
          <ErrorNote what="this delivery" error={shipment.error} onRetry={() => shipment.refetch()} />
        )}
      </div>
    );
  }

  const layers = shipmentLayers(s, routes, { drawInActive: false });
  const eta = s.current_eta;
  const hist = history.data ?? [];
  const previous = eta && hist[0]?.id === eta.id ? hist[1] : hist[0];
  const myNotes = (notes.data ?? []).filter((n) => n.shipment_id === s.id);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
      <div>
        <Link to="/customer" className="inline-flex items-center gap-1.5 rounded-sm text-meta font-medium text-ink-2 hover:text-ink">
          <ArrowLeft size={14} weight="bold" aria-hidden /> My deliveries
        </Link>
        <h1 className="mt-2 text-figure font-semibold tracking-[-0.02em]">Order {s.order.id}</h1>
        <p className="text-body text-ink-2">
          {s.order.quantity_t} t {s.order.product.toLowerCase()} to {s.destination_name}
        </p>
      </div>

      {shipment.error && <ErrorNote what="the latest update" error={shipment.error} onRetry={() => shipment.refetch()} loadedAt={shipment.dataUpdatedAt} />}

      <Card aria-labelledby="why-h">
        <CardHeader title="Why this ETA" id="why-h" />
        <div className="p-5">{eta ? <EtaPanel snapshot={eta} previous={previous} audience="customer" /> : <EmptyState title="No estimate yet." />}</div>
      </Card>

      <Card aria-labelledby="where-h">
        <CardHeader title="Where it is" id="where-h">
          <StatusTag status={s.status} />
        </CardHeader>
        <div className="p-4">
          <div className="mb-4 px-1">
            <JourneyBar from={routes[s.planned_route_id]?.origin ?? "Plant X"} to={s.destination_name} progressKm={s.last_position?.progress_km ?? null} totalKm={routes[s.active_route_id]?.total_km ?? null} status={s.status} />
          </div>
          <ShipmentMap
            label={`Map of order ${s.order.id}. ${positionText(s, routes[s.active_route_id])}`}
            routes={layers.routes}
            markers={layers.marker ? [{ ...layers.marker, label: `Order ${s.order.id}`, emphasis: true }] : []}
            focusRouteIds={[s.planned_route_id, s.active_route_id]}
            className="h-[320px]"
          />
          <p className="tnum mt-3 text-body text-ink-2">
            <span className="font-medium text-ink">Position:</span> {positionText(s, routes[s.active_route_id])}
          </p>
          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[480px]">
              <MilestoneTimeline milestones={s.milestones} />
            </div>
          </div>
        </div>
      </Card>

      <Card aria-labelledby="facts-h">
        <CardHeader title="Delivery details" id="facts-h" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5">
          <KeyValue label="Transporter">{s.transporter_name}</KeyValue>
          <KeyValue label="Vehicle">{s.vehicle_reg}</KeyValue>
          <KeyValue label="Original promise">{clockTz(s.order.original_promised_by)}</KeyValue>
          <KeyValue label="Agreed delivery">{clockTz(s.order.agreed_delivery_by)}</KeyValue>
        </dl>
      </Card>

      <Card aria-labelledby="notes-h">
        <CardHeader title="Updates we sent you" id="notes-h" />
        {!myNotes.length ? (
          <p className="px-5 py-6 text-body text-muted">No updates yet. We will tell you here if anything changes.</p>
        ) : (
          <ol className="divide-y divide-line">
            {myNotes.map((n) => (
              <li key={n.id} className="px-5 py-4">
                <p className="text-body font-semibold">{n.title}</p>
                <p className="text-body text-ink-2">{n.body}</p>
                <p className="tnum mt-1 text-meta text-muted">{dateTimeTz(n.created_at)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
