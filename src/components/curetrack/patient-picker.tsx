import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PatientView } from "@/lib/curetrack/selectors";

export function PatientPicker({
  views,
  selectedId,
  onSelect,
  meta,
  title = "Select patient",
}: {
  views: PatientView[];
  selectedId?: string;
  onSelect: (id: string) => void;
  meta: (v: PatientView) => ReactNode;
  title?: string;
}) {
  const [q, setQ] = useState("");
  const rows = views.filter((v) => {
    const s = q.trim().toLowerCase();
    return !s || [v.patient.name, v.patient.id, v.bedNumber ?? ""].some((x) => x.toLowerCase().includes(s));
  });
  return (
    <section className="surface flex max-h-[calc(100vh-160px)] flex-col">
      <div className="border-b p-3">
        <div className="mb-2 text-[15px] font-semibold">{title}</div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, ID or bed" className="pl-9" aria-label="Search patients" />
        </div>
      </div>
      <ul className="flex-1 divide-y overflow-y-auto" role="listbox" aria-label={title}>
        {rows.map((v) => {
          const active = v.patient.id === selectedId;
          return (
            <li key={v.patient.id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onSelect(v.patient.id)}
                className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors", active ? "bg-accent" : "hover:bg-muted/60")}
              >
                <div className={cn("grid size-9 shrink-0 place-items-center rounded-md font-mono text-xs font-semibold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {v.bedNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{v.patient.name}</div>
                  <div className="text-xs text-muted-foreground">{v.patient.id}</div>
                </div>
                <div className="shrink-0">{meta(v)}</div>
              </button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No matching patients</li>}
      </ul>
    </section>
  );
}
