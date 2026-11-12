import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Flag,
  HeartPulse,
  LogOut,
  ShieldAlert,
  Skull,
  Stethoscope,
  Thermometer,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge, TempValue } from "@/components/curetrack/bits";
import { RecoveryPips } from "@/components/curetrack/recovery-progress";
import { FlowChart, OccupancyBar } from "@/components/curetrack/charts";
import { useAppState, useCurrentUser, useNow } from "@/lib/curetrack/store";
import { allPatientViews, visiblePatientViews, type PatientView } from "@/lib/curetrack/selectors";
import { bedSummary, dailyFlow, MORTALITY_BENCHMARK, outcomeRates, SURVIVAL_BENCHMARK } from "@/lib/curetrack/analytics";
import { fmtPct, fmtRelative, fmtTime } from "@/lib/curetrack/format";
import { dayKey } from "@/lib/curetrack/recovery";
import type { AppState, AuditEntry } from "@/lib/curetrack/types";

export const Route = createFileRoute("/_console/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CureTrack" },
      { name: "description", content: "Role-specific CureTrack dashboard for quarantine ward operations." },
      { property: "og:title", content: "Dashboard — CureTrack" },
      { property: "og:description", content: "Live ward status, pending temperature rounds, doctor visits and bed occupancy." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const user = useCurrentUser();
  if (user.role === "nurse") return <NurseDashboard />;
  if (user.role === "doctor") return <DoctorDashboard />;
  if (user.role === "admin") return <AdminDashboard />;
  return <HeadDoctorDashboard />;
}

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function PatientLink({ v }: { v: PatientView }) {
  return (
    <Link to="/patients/$patientId" params={{ patientId: v.patient.id }} className="font-medium text-foreground hover:text-primary">
      {v.patient.name}
    </Link>
  );
}

/* --------------------------------- Nurse --------------------------------- */

function NurseDashboard() {
  const state = useAppState();
  const user = useCurrentUser();
  const now = useNow();
  const t = state.settings.feverThreshold;
  const mine = visiblePatientViews(state, user, now).filter((v) => v.active);
  const recorded = mine.filter((v) => v.todayReading);
  const pending = mine.filter((v) => !v.todayReading);
  const elevated = mine.filter((v) => v.todayReading && v.todayReading.temperature >= t);
  const approaching = mine.filter((v) => v.approaching);
  const sorted = [...mine].sort((a, b) => Number(!!a.todayReading) - Number(!!b.todayReading) || (a.bedNumber ?? "").localeCompare(b.bedNumber ?? ""));

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${user.name.split(" ")[0]}`}
        description={`${pending.length} of ${mine.length} assigned patients still need today's temperature.`}
        actions={
          <Button asChild size="lg">
            <Link to="/temperature" search={{}}>
              <Thermometer /> Record temperature
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Assigned patients" value={mine.length} icon={Users} to="/patients" />
        <StatCard label="Recorded today" value={recorded.length} icon={CheckCircle2} tone="success" hint={`${mine.length ? Math.round((recorded.length / mine.length) * 100) : 0}% complete`} />
        <StatCard label="Pending readings" value={pending.length} icon={Clock} tone={pending.length ? "warning" : "success"} />
        <StatCard label="Elevated today" value={elevated.length} icon={AlertTriangle} tone={elevated.length ? "critical" : "neutral"} hint={`≥ ${t.toFixed(1)}°C`} />
        <StatCard label="Approaching recovery" value={approaching.length} icon={TrendingUp} tone="default" hint={`${state.settings.recoveryDays - 1} of ${state.settings.recoveryDays} days done`} />
      </div>

      <Panel className="mt-6" title="My patients" description="Pending readings are listed first." bodyClassName="p-0">
        {sorted.length === 0 ? (
          <EmptyState icon={Users} title="No assigned patients" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Patient</TableHead>
                  <TableHead>Bed</TableHead>
                  <TableHead>Latest temp</TableHead>
                  <TableHead>Last recorded</TableHead>
                  <TableHead>Today</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recovery</TableHead>
                  <TableHead className="pr-4 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((v) => (
                  <TableRow key={v.patient.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2">
                        <PatientLink v={v} />
                        {v.patient.attentionFlag && <Flag className="size-3.5 text-critical-strong" aria-label="Flagged" />}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{v.patient.id}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{v.bedNumber}</TableCell>
                    <TableCell><TempValue value={v.latest?.temperature} threshold={t} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.latest ? fmtRelative(v.latest.recordedAt) : "Never"}</TableCell>
                    <TableCell>
                      {v.todayReading ? <Badge variant="success">Recorded {fmtTime(v.todayReading.recordedAt)}</Badge> : <Badge variant="warning">Pending</Badge>}
                    </TableCell>
                    <TableCell><StatusBadge status={v.displayStatus} /></TableCell>
                    <TableCell><RecoveryPips recovery={v.recovery} /></TableCell>
                    <TableCell className="pr-4 text-right">
                      {v.todayReading ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/patients/$patientId" params={{ patientId: v.patient.id }}>View</Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm">
                          <Link to="/temperature" search={{ patient: v.patient.id }}>Record</Link>
                        </Button>
                      )}
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

/* -------------------------------- Doctor --------------------------------- */

const CLINICAL_ACTIONS = new Set(["temperature_recorded", "temperature_corrected", "doctor_visit", "clinical_decision", "attention_flagged", "emergency_override", "discharge_confirmed"]);

function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return <EmptyState icon={Activity} title="No recent activity" />;
  return (
    <ul className="divide-y">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3 px-4 py-2.5">
          <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-foreground">{e.details}</div>
            <div className="text-xs text-muted-foreground">
              {e.userName} · {fmtRelative(e.timestamp)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PatientRows({ rows, action, t }: { rows: PatientView[]; action: (v: PatientView) => React.ReactNode; t: number }) {
  return (
    <ul className="divide-y">
      {rows.map((v) => (
        <li key={v.patient.id} className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm">
              <PatientLink v={v} />
              {v.patient.attentionFlag && <Flag className="size-3.5 text-critical-strong" />}
            </div>
            <div className="text-xs text-muted-foreground">
              Bed <span className="font-mono">{v.bedNumber}</span> · Today{" "}
              <TempValue value={v.todayReading?.temperature} threshold={t} className="text-xs" />
            </div>
          </div>
          {action(v)}
        </li>
      ))}
    </ul>
  );
}

function DoctorDashboard() {
  const state = useAppState();
  const user = useCurrentUser();
  const now = useNow();
  const t = state.settings.feverThreshold;
  const active = allPatientViews(state, now).filter((v) => v.active);
  const awaitingVisit = active.filter((v) => !v.todayVisit);
  const ready = awaitingVisit.filter((v) => v.todayReading).sort((a, b) => (b.todayReading!.temperature - a.todayReading!.temperature));
  const blocked = active.filter((v) => !v.todayReading);
  const elevated = active.filter((v) => v.todayReading && v.todayReading.temperature >= t);
  const approaching = active.filter((v) => v.approaching);
  const toConfirm = active.filter((v) => v.recovery?.eligible && v.patient.clinicalDecision !== "medically_recovered");
  const feed = state.audit.filter((a) => CLINICAL_ACTIONS.has(a.action)).slice(0, 8);

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${user.name}`}
        description="Review today's temperature before each routine visit."
        actions={
          <Button asChild>
            <Link to="/visits" search={{}}>
              <Stethoscope /> Record visit
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Awaiting visit today" value={awaitingVisit.length} icon={Stethoscope} hint={`${ready.length} ready for rounds`} />
        <StatCard label="Temp not recorded" value={blocked.length} icon={Clock} tone={blocked.length ? "warning" : "success"} hint="Routine visit blocked" />
        <StatCard label="Elevated today" value={elevated.length} icon={AlertTriangle} tone={elevated.length ? "critical" : "neutral"} />
        <StatCard label="Approaching recovery" value={approaching.length} icon={TrendingUp} />
        <StatCard label="Confirm recovery" value={toConfirm.length} icon={ClipboardCheck} tone={toConfirm.length ? "success" : "neutral"} hint="Criteria met" to="/recovery" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Ready for rounds" description="Temperature recorded today, no visit yet. Highest first." bodyClassName="p-0" className="xl:col-span-1">
          {ready.length ? (
            <PatientRows
              rows={ready}
              t={t}
              action={(v) => (
                <Button asChild size="sm" variant="outline">
                  <Link to="/visits" search={{ patient: v.patient.id }}>Visit</Link>
                </Button>
              )}
            />
          ) : (
            <EmptyState icon={CheckCircle2} title="No patients waiting">Everyone with today's reading has been seen.</EmptyState>
          )}
        </Panel>
        <Panel title="Waiting on temperature" description="Routine visit cannot be recorded until the nurse records today's reading." bodyClassName="p-0">
          {blocked.length ? (
            <PatientRows rows={blocked} t={t} action={() => <Badge variant="warning">Temp pending</Badge>} />
          ) : (
            <EmptyState icon={CheckCircle2} title="All temperatures recorded" />
          )}
        </Panel>
        <Panel title="Recent clinical activity" bodyClassName="p-0">
          <ActivityFeed entries={feed} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Recovery criteria met" description="Awaiting your clinical confirmation." bodyClassName="p-0">
          {toConfirm.length ? (
            <PatientRows
              rows={toConfirm}
              t={t}
              action={(v) => (
                <Button asChild size="sm" variant="success">
                  <Link to="/visits" search={{ patient: v.patient.id }}>Assess</Link>
                </Button>
              )}
            />
          ) : (
            <EmptyState icon={HeartPulse} title="No patients awaiting confirmation" />
          )}
        </Panel>
        <Panel title="Approaching eligibility" description={`${state.settings.recoveryDays - 1} of ${state.settings.recoveryDays} fever-free days completed.`} bodyClassName="p-0">
          {approaching.length ? (
            <PatientRows rows={approaching} t={t} action={(v) => <RecoveryPips recovery={v.recovery} />} />
          ) : (
            <EmptyState icon={TrendingUp} title="No patients approaching eligibility" />
          )}
        </Panel>
      </div>
    </>
  );
}

/* --------------------------------- Admin --------------------------------- */

function opsToday(state: AppState, now: Date) {
  const k = dayKey(now);
  return {
    admissions: state.patients.filter((p) => dayKey(p.admissionDate) === k).length,
    discharges: state.patients.filter((p) => p.dischargeDate && dayKey(p.dischargeDate) === k).length,
  };
}

function AdminDashboard() {
  const state = useAppState();
  const user = useCurrentUser();
  const now = useNow();
  const beds = bedSummary(state);
  const active = allPatientViews(state, now).filter((v) => v.active);
  const eligible = active.filter((v) => v.recovery?.eligible);
  const readyToDischarge = eligible.filter((v) => v.patient.clinicalDecision === "medically_recovered");
  const today = opsToday(state, now);
  const flow = dailyFlow(state, 14, now);
  const wards = Array.from(new Set(state.beds.map((b) => b.ward)));

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${user.name.split(" ")[0]}`}
        description="Facility operations at a glance."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/discharge"><LogOut /> Discharges</Link>
            </Button>
            <Button asChild>
              <Link to="/patients/new"><UserPlus /> Register patient</Link>
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total capacity" value={beds.capacity} icon={BedDouble} tone="neutral" hint="Beds" />
        <StatCard label="Occupied beds" value={beds.occupied} icon={BedDouble} tone="critical" hint={fmtPct(beds.occupancyRate, 0) + " occupancy"} to="/beds" />
        <StatCard label="Available beds" value={beds.available} icon={BedDouble} tone={beds.available <= state.settings.lowBedThreshold ? "warning" : "success"} hint={`${beds.held} reserved/unavailable`} to="/beds" />
        <StatCard label="Current admissions" value={active.length} icon={Users} to="/patients" />
        <StatCard label="Eligible for discharge" value={eligible.length} icon={HeartPulse} tone="success" hint="Recovery criteria met" />
        <StatCard label="Pending discharges" value={readyToDischarge.length} icon={ClipboardCheck} tone={readyToDischarge.length ? "warning" : "neutral"} hint="Doctor-confirmed" to="/discharge" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Bed occupancy" description={`${beds.occupied} of ${beds.capacity} beds occupied`} className="xl:col-span-1">
          <div className="text-3xl font-semibold tabular">{fmtPct(beds.occupancyRate)}</div>
          <div className="mt-3">
            <OccupancyBar occupied={beds.occupied} held={beds.held} capacity={beds.capacity} />
          </div>
          <div className="mt-5 space-y-2.5">
            {wards.map((w) => {
              const wb = state.beds.filter((b) => b.ward === w);
              const occ = wb.filter((b) => b.status === "occupied").length;
              return (
                <div key={w}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground">{w}</span>
                    <span className="tabular text-muted-foreground">{occ}/{wb.length}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(occ / wb.length) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="Admissions & discharges"
          description="Last 14 days"
          className="xl:col-span-2"
          actions={
            <div className="flex gap-4 text-right text-xs">
              <div><div className="text-muted-foreground">Admitted today</div><div className="text-lg font-semibold tabular">{today.admissions}</div></div>
              <div><div className="text-muted-foreground">Discharged today</div><div className="text-lg font-semibold tabular">{today.discharges}</div></div>
            </div>
          }
        >
          <FlowChart data={flow} height={260} />
        </Panel>
      </div>

      <Panel className="mt-6" title="Discharge queue" description="Patients who have met recovery criteria." bodyClassName="p-0"
        actions={<Button asChild size="sm" variant="outline"><Link to="/discharge">Open discharge management</Link></Button>}>
        {eligible.length ? (
          <ul className="divide-y">
            {eligible.map((v) => (
              <li key={v.patient.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <PatientLink v={v} />
                  <div className="text-xs text-muted-foreground">Bed <span className="font-mono">{v.bedNumber}</span> · {v.recovery!.completedDays} fever-free days</div>
                </div>
                {v.patient.clinicalDecision === "medically_recovered" ? (
                  <Badge variant="success">Doctor confirmed — ready</Badge>
                ) : (
                  <Badge variant="warning">Awaiting doctor confirmation</Badge>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={ClipboardCheck} title="No patients eligible yet" />
        )}
      </Panel>
    </>
  );
}

/* ------------------------------ Head doctor ------------------------------ */

function HeadDoctorDashboard() {
  const state = useAppState();
  const user = useCurrentUser();
  const now = useNow();
  const t = state.settings.feverThreshold;
  const views = allPatientViews(state, now);
  const active = views.filter((v) => v.active);
  const beds = bedSummary(state);
  const outcomes = outcomeRates(state.patients);
  const elevated = active.filter((v) => v.todayReading && v.todayReading.temperature >= t);
  const flagged = active.filter((v) => v.patient.attentionFlag);
  const weekAgo = new Date(now.getTime() - 7 * 864e5).toISOString();
  const overrides = state.audit.filter((a) => a.action === "emergency_override" && a.timestamp >= weekAgo);
  const corrections = state.audit.filter((a) => a.action === "temperature_corrected" && a.timestamp >= weekAgo);
  const missing = active.filter((v) => !v.todayReading);
  const pipeline = [
    { label: "Fever detected", n: active.filter((v) => v.displayStatus === "fever").length, cls: "bg-destructive" },
    { label: "Under observation", n: active.filter((v) => v.displayStatus === "under_observation").length, cls: "bg-warning" },
    { label: "Admitted, no streak", n: active.filter((v) => v.displayStatus === "admitted").length, cls: "bg-chart-5" },
    { label: "Recovery tracking", n: active.filter((v) => v.displayStatus === "recovery_tracking").length, cls: "bg-primary" },
    { label: "Eligible for discharge", n: active.filter((v) => v.displayStatus === "eligible").length, cls: "bg-success" },
  ];

  return (
    <>
      <PageHeader title={`${greeting(now)}, ${user.name}`} description="Clinical oversight and hospital-wide performance."
        actions={<Button asChild variant="outline"><Link to="/analytics">Full analytics</Link></Button>} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Active patients" value={active.length} icon={Users} to="/patients" />
        <StatCard label="Bed occupancy" value={fmtPct(beds.occupancyRate, 0)} icon={BedDouble} hint={`${beds.occupied}/${beds.capacity} beds`} to="/beds" />
        <StatCard label="Mortality rate" value={outcomes.mortalityRate == null ? "—" : fmtPct(outcomes.mortalityRate)} icon={Skull} tone="neutral"
          hint={outcomes.mortalityRate == null ? "Insufficient outcome data" : `Benchmark ${MORTALITY_BENCHMARK}% · n=${outcomes.completed}`} />
        <StatCard label="Survival rate" value={outcomes.survivalRate == null ? "—" : fmtPct(outcomes.survivalRate)} icon={HeartPulse} tone="success"
          hint={outcomes.survivalRate == null ? "Insufficient outcome data" : `Benchmark ${SURVIVAL_BENCHMARK}% · n=${outcomes.completed}`} />
        <StatCard label="Clinical exceptions" value={elevated.length + flagged.length + overrides.length} icon={ShieldAlert} tone="critical" hint="Fever, flags, overrides (7d)" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Clinical exceptions" description="Items that may need senior review." bodyClassName="p-0">
          <ul className="divide-y text-sm">
            {elevated.map((v) => (
              <li key={"e" + v.patient.id} className="flex items-center gap-3 px-4 py-2.5">
                <Thermometer className="size-4 text-critical-strong" />
                <div className="flex-1"><PatientLink v={v} /> <span className="text-muted-foreground">— fever today</span></div>
                <TempValue value={v.todayReading!.temperature} threshold={t} />
              </li>
            ))}
            {flagged.map((v) => (
              <li key={"f" + v.patient.id} className="flex items-start gap-3 px-4 py-2.5">
                <Flag className="mt-0.5 size-4 text-critical-strong" />
                <div className="flex-1"><PatientLink v={v} /><div className="text-xs text-muted-foreground">{v.patient.attentionFlag!.reason}</div></div>
              </li>
            ))}
            {overrides.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                <ShieldAlert className="mt-0.5 size-4 text-warning-strong" />
                <div className="flex-1"><div className="text-[13px]">{a.details}</div><div className="text-xs text-muted-foreground">{a.userName} · {fmtRelative(a.timestamp)}</div></div>
              </li>
            ))}
            {corrections.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                <AlertTriangle className="mt-0.5 size-4 text-warning-strong" />
                <div className="flex-1"><div className="text-[13px]">{a.details}</div><div className="text-xs text-muted-foreground">{a.userName} · {fmtRelative(a.timestamp)}</div></div>
              </li>
            ))}
            <li className="flex items-center gap-3 px-4 py-2.5">
              <Clock className="size-4 text-warning-strong" />
              <div className="flex-1">{missing.length} patients without today's temperature</div>
            </li>
          </ul>
        </Panel>
        <Panel title="Recovery pipeline" description="Where active patients are in their recovery.">
          <div className="space-y-3">
            {pipeline.map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-sm">
                  <span>{p.label}</span>
                  <span className="font-semibold tabular">{p.n}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${p.cls}`} style={{ width: `${active.length ? (p.n / active.length) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="mt-6" title="Recent staff activity" bodyClassName="p-0" actions={<Button asChild size="sm" variant="outline"><Link to="/audit">Audit log</Link></Button>}>
        <ActivityFeed entries={state.audit.slice(0, 8)} />
      </Panel>
    </>
  );
}
