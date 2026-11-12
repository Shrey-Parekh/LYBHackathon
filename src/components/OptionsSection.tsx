import type { ShipmentDetail } from "../api/contract";

/* Options table and approval dialog arrive with milestone M3 (DESIGN.md 6.7, 7.2). */
export function OptionsSection({ shipment }: { shipment: ShipmentDetail }) {
  void shipment;
  return null;
}
