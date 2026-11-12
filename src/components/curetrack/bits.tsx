import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { Lock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DISPLAY_STATUS_LABEL, type DisplayStatus } from "@/lib/curetrack/selectors";
import { ROLE_LABELS, type Role } from "@/lib/curetrack/types";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  default: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success-strong",
  warning: "bg-warning-soft text-warning-strong",
  critical: "bg-critical-soft text-critical-strong",
  neutral: "bg-muted text-muted-foreground",
} as const;
export type Tone = keyof typeof TONES;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  to,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  to?: LinkProps["to"];
}) {
  const body = (
    <div className={cn("surface h-full p-4", to && "transition-shadow hover:shadow-raised")}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
        <div className={cn("grid size-8 place-items-center rounded-md", TONES[tone])}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-2 text-[26px] font-semibold tabular tracking-tight text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

const STATUS_VARIANT: Record<DisplayStatus, "success" | "warning" | "critical" | "info" | "neutral"> = {
  admitted: "info",
  under_observation: "warning",
  fever: "critical",
  recovery_tracking: "info",
  eligible: "success",
  discharged: "neutral",
  deceased: "neutral",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{DISPLAY_STATUS_LABEL[status]}</Badge>;
}

export function TempValue({
  value,
  threshold,
  className,
}: {
  value: number | null | undefined;
  threshold: number;
  className?: string;
}) {
  if (value == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const fever = value >= threshold;
  const low = value < 35.5;
  return (
    <span
      className={cn(
        "font-mono tabular font-medium",
        fever ? "text-critical-strong" : low ? "text-warning-strong" : "text-foreground",
        className,
      )}
    >
      {value.toFixed(1)}°C
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant="neutral">{ROLE_LABELS[role]}</Badge>;
}

export function AccessDenied({ what }: { what: string }) {
  return (
    <div className="surface mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
        <Lock className="size-5 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Access restricted</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your role does not have permission to {what}. Switch to an authorised demo role from the profile menu.
      </p>
      <Link to="/dashboard" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="grid size-10 place-items-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="mt-3 text-sm font-medium text-foreground">{title}</div>
      {children && <div className="mt-1 max-w-sm text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs font-medium text-critical-strong">{children}</p>;
}
