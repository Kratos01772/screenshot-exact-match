import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-sidebar" />
      <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" className="fill-sidebar-primary" />
      <path
        d="M11 17.5l3 3 7-7"
        fill="none"
        className="stroke-sidebar-primary-foreground"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={inverted ? "ring-1 ring-sidebar-border rounded-lg" : undefined} />
      <div className="leading-tight">
        <div className={cn("text-[15px] font-semibold tracking-tight", inverted ? "text-sidebar-accent-foreground" : "text-foreground")}>
          CureTrack
        </div>
        <div className={cn("text-[11px]", inverted ? "text-sidebar-muted" : "text-muted-foreground")}>
          Smarter Quarantine. Safer Recovery.
        </div>
      </div>
    </div>
  );
}
