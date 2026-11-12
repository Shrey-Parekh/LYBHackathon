import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useShipment, useShipments } from "../../api/queries";
import { getOutbox, onOutboxSent, useOutbox } from "../../api/outbox";

/** The driver's current trip: the first assigned shipment that is not delivered or cancelled. */
export function useCurrentTrip() {
  const list = useShipments();
  const currentId = list.data?.find((s) => s.status !== "DELIVERED" && s.status !== "CANCELLED")?.id;
  const detail = useShipment(currentId);
  return { list, detail, currentId };
}

/** The outbox plus a refetch of the trip whenever one of its events is accepted. */
export function useDriverOutbox() {
  const qc = useQueryClient();
  const outbox = getOutbox();
  const state = useOutbox(outbox);
  useEffect(
    () =>
      onOutboxSent((item) => {
        qc.invalidateQueries({ queryKey: ["shipment", item.shipment_id] });
        qc.invalidateQueries({ queryKey: ["shipments"] });
        qc.invalidateQueries({ queryKey: ["eta-history", item.shipment_id] });
      }),
    [qc],
  );
  return { outbox, ...state };
}
