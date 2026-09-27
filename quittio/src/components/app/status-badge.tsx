import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/lib/rent";

const MAP: Record<PaymentStatus, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "outline" }> = {
  paid: { label: "Payé", variant: "success" },
  partial: { label: "Partiel", variant: "warning" },
  due: { label: "À encaisser", variant: "secondary" },
  late: { label: "En retard", variant: "destructive" },
  upcoming: { label: "À venir", variant: "outline" },
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const s = MAP[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
