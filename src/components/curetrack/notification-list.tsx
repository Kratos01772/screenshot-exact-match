import { Link } from "@tanstack/react-router";
import { AlertTriangle, BedDouble, CheckCircle2, Clock, Flag, Thermometer, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/curetrack/selectors";
import { EmptyState } from "./bits";

const ICONS = {
  missing_reading: Clock,
  elevated: Thermometer,
  pending_visit: AlertTriangle,
  approaching: TrendingUp,
  eligible: CheckCircle2,
  low_beds: BedDouble,
  attention: Flag,
};
const TONE = {
  critical: "bg-critical-soft text-critical-strong",
  warning: "bg-warning-soft text-warning-strong",
  info: "bg-info-soft text-info-strong",
  success: "bg-success-soft text-success-strong",
};

export function NotificationList({
  items,
  compact,
  onNavigate,
}: {
  items: AppNotification[];
  compact?: boolean;
  onNavigate?: () => void;
}) {
  if (!items.length)
    return (
      <EmptyState icon={CheckCircle2} title="All clear">
        No outstanding alerts for your role right now.
      </EmptyState>
    );
  return (
    <ul className="divide-y">
      {items.map((n) => {
        const Icon = ICONS[n.kind];
        const inner = (
          <div className={cn("flex gap-3 px-4", compact ? "py-2.5" : "py-3")}>
            <div className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-md", TONE[n.severity])}>
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground">{n.title}</div>
              <div className="truncate text-xs text-muted-foreground">{n.description}</div>
            </div>
          </div>
        );
        return (
          <li key={n.id}>
            {n.patientId ? (
              <Link to="/patients/$patientId" params={{ patientId: n.patientId }} onClick={onNavigate} className="block hover:bg-muted/60">
                {inner}
              </Link>
            ) : (
              <Link to="/beds" onClick={onNavigate} className="block hover:bg-muted/60">
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
