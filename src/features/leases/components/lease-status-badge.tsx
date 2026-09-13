import { Badge } from "@/components/ui/badge";
import type { LeaseStatus } from "@/generated/prisma/enums";

const CONFIG: Record<
  LeaseStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  DRAFT: { label: "Draft", variant: "outline" },
  PENDING: { label: "Pending", variant: "secondary" },
  ACTIVE: { label: "Active", variant: "default" },
  ENDED: { label: "Ended", variant: "secondary" },
  TERMINATED: { label: "Terminated", variant: "destructive" },
};

export function LeaseStatusBadge({ status }: { status: LeaseStatus }) {
  const { label, variant } = CONFIG[status];
  return <Badge variant={variant}>{label}</Badge>;
}
