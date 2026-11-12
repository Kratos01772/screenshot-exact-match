import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Flag, Search, UserPlus, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, Panel, StatusBadge, TempValue } from "@/components/curetrack/bits";
import { RecoveryPips } from "@/components/curetrack/recovery-progress";
import { cn } from "@/lib/utils";
import { can } from "@/lib/curetrack/permissions";
import { FILTERS, matchesFilter, visiblePatientViews, type FilterKey } from "@/lib/curetrack/selectors";
import { useAppState, useCurrentUser, useNow } from "@/lib/curetrack/store";
import { fmtDate } from "@/lib/curetrack/format";

interface PatientSearch {
  q?: string;
  filter?: FilterKey;
}

export const Route = createFileRoute("/_console/patients/")({
  validateSearch: (s: Record<string, unknown>): PatientSearch => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    filter: FILTERS.some((f) => f.key === s.filter) ? (s.filter as FilterKey) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Patients — CureTrack" },
      { name: "description", content: "Search and filter quarantine patients by status, fever and recovery progress." },
      { property: "og:title", content: "Patients — CureTrack" },
      { property: "og:description", content: "Searchable patient register with recovery progress." },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const state = useAppState();
  const user = useCurrentUser();
  const now = useNow();
  const { q = "", filter = "all" } = Route.useSearch();
  const navigate = useNavigate({ from: "/patients/" });
  const t = state.settings.feverThreshold;
  const views = visiblePatientViews(state, user, now);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, views.filter((v) => matchesFilter(v, f.key)).length])), [views]);
  const rows = views
    .filter((v) => matchesFilter(v, filter))
    .filter((v) => {
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return [v.patient.name, v.patient.id, v.bedNumber ?? ""].some((x) => x.toLowerCase().includes(s));
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || b.patient.admissionDate.localeCompare(a.patient.admissionDate));

  return (
    <>
      <PageHeader
        title="Patients"
        description={user.role === "nurse" ? "Patients assigned to you." : `${counts.admitted} currently admitted · ${views.length} total records`}
        actions={
          can(user.role, "patient:register") && (
            <Button asChild>
              <Link to="/patients/new"><UserPlus /> Register patient</Link>
            </Button>
          )
        }
      />
      <Panel bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => navigate({ search: (p) => ({ ...p, q: e.target.value || undefined }), replace: true })}
              placeholder="Search name, patient ID or bed"
              className="pl-9"
              aria-label="Search patients"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter patients">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => navigate({ search: (p) => ({ ...p, filter: f.key === "all" ? undefined : f.key }), replace: true })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {f.label} <span className="ml-1 tabular opacity-75">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No patients match">Try a different search or filter.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Patient ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Bed</TableHead>
                  <TableHead>Admitted</TableHead>
                  <TableHead>Latest temp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recovery</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((v) => (
                  <TableRow key={v.patient.id} className={cn(!v.active && "text-muted-foreground")}>
                    <TableCell className="pl-4 font-mono text-xs">{v.patient.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Link to="/patients/$patientId" params={{ patientId: v.patient.id }} className="font-medium text-foreground hover:text-primary">
                          {v.patient.name}
                        </Link>
                        {v.patient.attentionFlag && <Flag className="size-3.5 text-critical-strong" aria-label="Flagged for attention" />}
                      </div>
                    </TableCell>
                    <TableCell className="tabular">{v.patient.age}</TableCell>
                    <TableCell className="font-mono text-sm">{v.active ? v.bedNumber : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{fmtDate(v.patient.admissionDate)}</TableCell>
                    <TableCell><TempValue value={v.latest?.temperature} threshold={t} /></TableCell>
                    <TableCell><StatusBadge status={v.displayStatus} /></TableCell>
                    <TableCell><RecoveryPips recovery={v.recovery} /></TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {v.active && can(user.role, "temperature:record") && !v.todayReading && (
                          <Button asChild size="sm"><Link to="/temperature" search={{ patient: v.patient.id }}>Record temp</Link></Button>
                        )}
                        {v.active && can(user.role, "visit:record") && !v.todayVisit && (
                          <Button asChild size="sm" variant="outline"><Link to="/visits" search={{ patient: v.patient.id }}>Visit</Link></Button>
                        )}
                        {v.active && can(user.role, "discharge:confirm") && v.recovery?.eligible && (
                          <Button asChild size="sm" variant="success"><Link to="/discharge" search={{ patient: v.patient.id }}>Discharge</Link></Button>
                        )}
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/patients/$patientId" params={{ patientId: v.patient.id }}>View</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </>
  );
}
