import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, Info, Thermometer, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AccessDenied, EmptyState, FieldError, PageHeader, Panel, StatusBadge, TempValue } from "@/components/curetrack/bits";
import { PatientPicker } from "@/components/curetrack/patient-picker";
import { RecoveryPips } from "@/components/curetrack/recovery-progress";
import { cn } from "@/lib/utils";
import { can } from "@/lib/curetrack/permissions";
import { recordTemperature, temperatureWarnings } from "@/lib/curetrack/actions";
import { visiblePatientViews } from "@/lib/curetrack/selectors";
import { perform, useAppState, useCurrentUser, useNow } from "@/lib/curetrack/store";
import { fmtRelative, fmtTime } from "@/lib/curetrack/format";

interface TempSearch {
  patient?: string;
}

export const Route = createFileRoute("/_console/temperature")({
  validateSearch: (s: Record<string, unknown>): TempSearch => ({
    patient: typeof s.patient === "string" ? s.patient : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Record temperature — CureTrack" },
      { name: "description", content: "Nurse workflow for recording daily patient temperatures with validation." },
      { property: "og:title", content: "Record temperature — CureTrack" },
      { property: "og:description", content: "Fast, validated daily temperature recording." },
    ],
  }),
  component: TemperaturePage,
});

function TemperaturePage() {
  const user = useCurrentUser();
  if (!can(user.role, "temperature:record")) return <AccessDenied what="record temperatures (nurses only)" />;
  return <TemperatureWorkflow />;
}

interface LastResult {
  patientName: string;
  temp: number;
  warnings: ReturnType<typeof temperatureWarnings>;
}

function TemperatureWorkflow() {
  const state = useAppState();
  const user = useCurrentUser();
  const now = useNow(15_000);
  const navigate = useNavigate({ from: "/temperature" });
  const { patient: selectedId } = Route.useSearch();
  const settings = state.settings;
  const views = visiblePatientViews(state, user, now)
    .filter((v) => v.active)
    .sort((a, b) => Number(!!a.todayReading) - Number(!!b.todayReading) || (a.bedNumber ?? "").localeCompare(b.bedNumber ?? ""));
  const selected = views.find((v) => v.patient.id === selectedId) ?? null;
  const pending = views.filter((v) => !v.todayReading);

  const [temp, setTemp] = useState("");
  const [observation, setObservation] = useState("");
  const [additional, setAdditional] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<LastResult | null>(null);

  const select = (id: string) => {
    setTemp("");
    setObservation("");
    setAdditional(false);
    setError(null);
    navigate({ search: { patient: id }, replace: true });
  };

  const routineDone = !!selected?.todayReading && selected.readings.some((r) => r.type === "routine" && r.id === selected.todayReading!.id || (r.type === "routine" && format(new Date(r.recordedAt), "yyyy-MM-dd") === format(now, "yyyy-MM-dd")));
  const type = routineDone || additional ? "additional" : "routine";
  const n = temp === "" ? null : Number(temp);
  const outOfRange = n != null && (Number.isNaN(n) || n < settings.tempMin || n > settings.tempMax);
  const preview = n != null && !outOfRange ? temperatureWarnings(n, settings) : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (temp === "") return setError("Enter a temperature in °C.");
    const res = perform((s, a) => recordTemperature(s, a, { patientId: selected.patient.id, temperature: Number(temp), observation, type }));
    if (!res.ok) return setError(res.error);
    setLast({ patientName: selected.patient.name, temp: res.result.reading.temperature, warnings: res.result.warnings });
    setTemp("");
    setObservation("");
    setAdditional(false);
    setError(null);
  };

  const nextPending = pending.find((v) => v.patient.id !== selected?.patient.id);

  return (
    <>
      <PageHeader
        title="Record temperature"
        description={`${pending.length} of ${views.length} assigned patients still need today's routine reading.`}
      />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <PatientPicker
          views={views}
          selectedId={selected?.patient.id}
          onSelect={select}
          meta={(v) =>
            v.todayReading ? (
              <TempValue value={v.todayReading.temperature} threshold={settings.feverThreshold} className="text-xs" />
            ) : (
              <Badge variant="warning">Pending</Badge>
            )
          }
        />
        <div className="space-y-4">
          {last && (
            <div className={cn("flex flex-wrap items-start gap-3 rounded-lg border p-4", last.warnings.length ? "border-destructive/40 bg-critical-soft" : "border-success/40 bg-success-soft")}>
              {last.warnings.length ? <AlertTriangle className="mt-0.5 size-5 text-critical-strong" /> : <CheckCircle2 className="mt-0.5 size-5 text-success-strong" />}
              <div className="flex-1 text-sm">
                <div className={cn("font-semibold", last.warnings.length ? "text-critical-strong" : "text-success-strong")}>
                  Saved {last.temp.toFixed(1)}°C for {last.patientName}
                </div>
                {last.warnings.map((w) => <div key={w.message} className="text-critical-strong">{w.message}</div>)}
                <div className="text-muted-foreground">History, dashboards and recovery progress are updated.</div>
              </div>
              {nextPending && (
                <Button size="sm" variant="outline" onClick={() => { setLast(null); select(nextPending.patient.id); }}>
                  Next pending: {nextPending.patient.name} <ArrowRight />
                </Button>
              )}
            </div>
          )}

          {!selected ? (
            <Panel>
              <EmptyState icon={Thermometer} title="Select a patient">
                Choose a patient from the list. Patients without today's reading are shown first.
              </EmptyState>
            </Panel>
          ) : (
            <Panel
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {selected.patient.name}
                  <StatusBadge status={selected.displayStatus} />
                </span>
              }
              description={<>Bed <span className="font-mono">{selected.bedNumber}</span> · {selected.patient.id}</>}
              actions={<Button asChild size="sm" variant="ghost"><Link to="/patients/$patientId" params={{ patientId: selected.patient.id }}>Open profile</Link></Button>}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-muted p-3">
                  <div className="text-xs text-muted-foreground">Latest reading</div>
                  <div className="mt-1 text-lg"><TempValue value={selected.latest?.temperature} threshold={settings.feverThreshold} /></div>
                  <div className="text-xs text-muted-foreground">{selected.latest ? fmtRelative(selected.latest.recordedAt) : "No readings yet"}</div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <div className="text-xs text-muted-foreground">Today's routine reading</div>
                  <div className="mt-1 text-sm font-medium">
                    {selected.todayReading ? <>Recorded at {fmtTime(selected.todayReading.recordedAt)}</> : <span className="text-warning-strong">Not yet recorded</span>}
                  </div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <div className="text-xs text-muted-foreground">Recovery progress</div>
                  <div className="mt-2"><RecoveryPips recovery={selected.recovery} /></div>
                </div>
              </div>

              <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
                {routineDone && (
                  <div className="flex gap-2.5 rounded-md border border-warning/50 bg-warning-soft p-3 text-sm text-warning-strong">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <div>
                      Today's routine reading already exists ({selected.todayReading!.temperature.toFixed(1)}°C). Duplicate routine entries are blocked.
                      To fix a mistake, use <Link to="/patients/$patientId" params={{ patientId: selected.patient.id }} className="font-medium underline">Correct</Link> on the profile.
                      You can still log an <strong>additional clinical check</strong> below with an observation.
                    </div>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
                  <div>
                    <Label htmlFor="temp">Temperature (°C)</Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="temp"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min={settings.tempMin}
                        max={settings.tempMax}
                        autoFocus
                        value={temp}
                        onChange={(e) => { setTemp(e.target.value); setError(null); }}
                        placeholder="36.8"
                        className={cn("h-14 pr-12 font-mono text-2xl", outOfRange && "border-destructive focus-visible:ring-destructive")}
                        aria-invalid={outOfRange}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">°C</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Valid range {settings.tempMin}–{settings.tempMax}°C · fever at ≥ {settings.feverThreshold.toFixed(1)}°C (provisional)
                    </p>
                  </div>
                  <div>
                    <Label>Date and time</Label>
                    <div className="mt-1.5 flex h-14 items-center gap-2.5 rounded-md border bg-muted/60 px-3">
                      <Clock className="size-4 text-muted-foreground" />
                      <div className="leading-tight">
                        <div className="text-sm font-medium">{format(now, "EEEE, d MMMM yyyy")}</div>
                        <div className="text-xs tabular text-muted-foreground">{format(now, "HH:mm")} · recorded at submission</div>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Recording as {user.name}</p>
                  </div>
                </div>

                {outOfRange && (
                  <div className="rounded-md border border-destructive/40 bg-critical-soft p-3 text-sm text-critical-strong">
                    {Number.isNaN(n) ? "Enter a number." : `Outside the valid range of ${settings.tempMin}–${settings.tempMax}°C. Re-check the thermometer.`}
                  </div>
                )}
                {preview.map((w) => (
                  <div key={w.message} className={cn("flex gap-2 rounded-md border p-3 text-sm", w.level === "critical" ? "border-destructive/40 bg-critical-soft text-critical-strong" : "border-warning/50 bg-warning-soft text-warning-strong")}>
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w.message}
                  </div>
                ))}

                {!routineDone && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={additional} onChange={(e) => setAdditional(e.target.checked)} className="size-4 accent-primary" />
                    This is an additional clinical check, not the routine daily reading
                  </label>
                )}

                <div>
                  <Label htmlFor="obs">
                    Observation{" "}
                    <span className="font-normal text-muted-foreground">{type === "additional" ? "(required for additional checks)" : "(optional)"}</span>
                  </Label>
                  <Textarea id="obs" className="mt-1.5" rows={2} value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="e.g. Patient reports chills; paracetamol given 06:00" />
                </div>
                <FieldError>{error}</FieldError>
                <div className="flex items-center gap-3">
                  <Button type="submit" size="lg" disabled={outOfRange || temp === ""}>
                    <Thermometer /> Save {type === "routine" ? "routine reading" : "additional check"}
                  </Button>
                  <span className="text-xs text-muted-foreground">Readings cannot be overwritten; corrections keep the original value.</span>
                </div>
              </form>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
