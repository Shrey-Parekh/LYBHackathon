import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { streamStatus } from "./stream";
import type {
  Alert, Decision, DecisionRequest, DelayCauseRow, DemoState, EtaSnapshot, ImpactMetrics, Notification, OnTimeRow,
  OptionSet, RouteDetail, ShipmentDetail, ShipmentSummary,
} from "./contract";

/*
  One hook per endpoint. Components never call fetch directly.
  REST is the only source of data; the stream only tells us which of these keys to refetch (DESIGN.md 5.8).
  While the stream is down every visible query polls every 3 seconds.
*/
export const keys = {
  shipments: (filter = "") => ["shipments", filter] as const,
  shipment: (id: string) => ["shipment", id] as const,
  etaHistory: (id: string) => ["eta-history", id] as const,
  route: (id: string) => ["route", id] as const,
  alerts: ["alerts"] as const,
  options: (alertId: string) => ["options", alertId] as const,
  decisions: (shipmentId = "") => ["decisions", shipmentId] as const,
  notifications: ["notifications"] as const,
  onTime: (groupBy: string) => ["dashboard", "on-time", groupBy] as const,
  delayCauses: (groupBy: string) => ["dashboard", "delay-causes", groupBy] as const,
  impact: ["dashboard", "impact"] as const,
  demo: ["demo-state"] as const,
};

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        retry: 1,
        refetchOnWindowFocus: true,
        refetchInterval: () => (streamStatus.get() === "live" ? false : 3000),
        refetchIntervalInBackground: true,
      },
    },
  });
}

export const useShipments = (filter = "") =>
  useQuery({ queryKey: keys.shipments(filter), queryFn: ({ signal }) => api<ShipmentSummary[]>(`/shipments${filter ? `?${filter}` : ""}`, { signal }) });

export const useShipment = (id: string | undefined) =>
  useQuery({ queryKey: keys.shipment(id ?? ""), enabled: !!id, queryFn: ({ signal }) => api<ShipmentDetail>(`/shipments/${id}`, { signal }) });

export const useEtaHistory = (id: string | undefined) =>
  useQuery({ queryKey: keys.etaHistory(id ?? ""), enabled: !!id, queryFn: ({ signal }) => api<EtaSnapshot[]>(`/shipments/${id}/eta-history`, { signal }) });

/** Route geometry never changes during a run, so it is fetched once. */
export const useRoute = (id: string | undefined | null) =>
  useQuery({ queryKey: keys.route(id ?? ""), enabled: !!id, staleTime: Infinity, refetchInterval: false, queryFn: ({ signal }) => api<RouteDetail>(`/routes/${id}`, { signal }) });

export const useAlerts = (enabled = true) =>
  useQuery({ queryKey: keys.alerts, enabled, queryFn: ({ signal }) => api<Alert[]>(`/alerts`, { signal }) });

export const useOptions = (alertId: string | undefined | null) =>
  useQuery({ queryKey: keys.options(alertId ?? ""), enabled: !!alertId, queryFn: ({ signal }) => api<OptionSet>(`/alerts/${alertId}/options`, { signal }) });

export const useDecisions = (shipmentId = "") =>
  useQuery({ queryKey: keys.decisions(shipmentId), queryFn: ({ signal }) => api<Decision[]>(`/decisions${shipmentId ? `?shipment_id=${shipmentId}` : ""}`, { signal }) });

export const useNotifications = () =>
  useQuery({ queryKey: keys.notifications, queryFn: ({ signal }) => api<Notification[]>(`/notifications`, { signal }) });

export const useOnTime = (groupBy: "route" | "transporter") =>
  useQuery({ queryKey: keys.onTime(groupBy), queryFn: ({ signal }) => api<OnTimeRow[]>(`/dashboard/on-time?group_by=${groupBy}`, { signal }) });

export const useDelayCauses = (groupBy: "route" | "transporter") =>
  useQuery({ queryKey: keys.delayCauses(groupBy), queryFn: ({ signal }) => api<DelayCauseRow[]>(`/dashboard/delay-causes?group_by=${groupBy}`, { signal }) });

export const useImpact = () =>
  useQuery({ queryKey: keys.impact, queryFn: ({ signal }) => api<ImpactMetrics>(`/metrics/impact`, { signal }) });

export const useDemoState = (enabled = true) =>
  useQuery({ queryKey: keys.demo, enabled, queryFn: ({ signal }) => api<DemoState>(`/demo/state`, { signal }) });

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: "POST" }),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

export function useApproveDecision(shipmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: DecisionRequest) => api<Decision>(`/shipments/${shipmentId}/decisions`, { method: "POST", body: req }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.shipment(shipmentId) });
      qc.invalidateQueries({ queryKey: keys.etaHistory(shipmentId) });
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: keys.alerts });
      qc.invalidateQueries({ queryKey: ["options"] });
      qc.invalidateQueries({ queryKey: ["decisions"] });
    },
  });
}

export function useDemoCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) => api<unknown>(path, { method: "POST", body }),
    onSettled: () => qc.invalidateQueries(),
  });
}
