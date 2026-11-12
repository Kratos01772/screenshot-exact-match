import { Check, Minus, Thermometer, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtShortDate } from "@/lib/curetrack/format";
import type { RecoveryResult } from "@/lib/curetrack/recovery";

/** Compact pip bar: completed fever-free days out of required. */
export function RecoveryPips({ recovery }: { recovery: RecoveryResult | null }) {
  if (!recovery) return <span className="text-xs text-muted-foreground">—</span>;
  const done = Math.min(recovery.completedDays, recovery.required);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: recovery.required }).map((_, i) => (
          <span
            key={i}
            className={cn("h-1.5 w-5 rounded-full", i < done ? (recovery.eligible ? "bg-success" : "bg-primary") : "bg-border")}
          />
        ))}
      </div>
      <span className="text-xs tabular text-muted-foreground">
        {done}/{recovery.required}
      </span>
    </div>
  );
}

const DAY_STYLES = {
  fever_free: { icon: Check, cls: "border-success/40 bg-success-soft text-success-strong", label: "Fever-free" },
  fever: { icon: Thermometer, cls: "border-destructive/40 bg-critical-soft text-critical-strong", label: "Fever" },
  missing: { icon: Minus, cls: "border-warning/50 bg-warning-soft text-warning-strong", label: "No reading" },
} as const;

/** Detailed indicator of the last N completed days plus today. */
export function RecoveryTimeline({ recovery, threshold }: { recovery: RecoveryResult; threshold: number }) {
  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-2">
        {recovery.window.map((d, i) => {
          const s = DAY_STYLES[d.status];
          return (
            <div key={d.date} className={cn("rounded-md border px-3 py-2", s.cls)}>
              <div className="text-[11px] font-medium uppercase tracking-wide opacity-80">
                {fmtShortDate(d.date)} · Day {i + 1}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                <s.icon className="size-4" />
                {s.label}
              </div>
              <div className="font-mono text-xs tabular opacity-80">
                {d.maxTemp != null ? `max ${d.maxTemp.toFixed(1)}°C` : "—"}
              </div>
            </div>
          );
        })}
        <div className="rounded-md border border-dashed bg-muted/50 px-3 py-2 text-muted-foreground">
          <div className="text-[11px] font-medium uppercase tracking-wide">Today</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
            {recovery.feverToday ? (
              <>
                <Thermometer className="size-4 text-critical-strong" />
                <span className="text-critical-strong">Fever</span>
              </>
            ) : (
              <>
                <CircleDashed className="size-4" /> In progress
              </>
            )}
          </div>
          <div className="text-xs">Not counted yet</div>
        </div>
      </div>
      <p className="mt-3 text-sm text-foreground">{recoverySummary(recovery, threshold)}</p>
    </div>
  );
}

export function recoverySummary(r: RecoveryResult, threshold: number) {
  if (r.eligible)
    return "Recovery criteria met — awaiting doctor confirmation and administrative discharge.";
  if (r.feverToday)
    return `Fever recorded today (≥ ${threshold.toFixed(1)}°C). Streak reset; earliest eligibility ${fmtShortDate(r.projectedEligibleDate!)} if no further fever.`;
  const reason =
    r.streakBreak?.status === "missing"
      ? ` Streak stopped by a missing reading on ${fmtShortDate(r.streakBreak.date)} (missing days never count).`
      : r.streakBreak?.status === "fever"
        ? ` Streak reset by fever on ${fmtShortDate(r.streakBreak.date)}.`
        : "";
  return `${r.completedDays} of ${r.required} fever-free days completed.${reason} Eligible from ${fmtShortDate(r.projectedEligibleDate!)} if every day stays fever-free.`;
}
