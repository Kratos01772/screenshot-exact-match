import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, Flag, History, LogOut, PencilLine, ShieldAlert, Stethoscope, Thermometer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccessDenied, EmptyState, FieldError, PageHeader, Panel, StatusBadge, TempValue } from "@/components/curetrack/bits";
import { RecoveryTimeline } from "@/components/curetrack/recovery-progress";
import { TemperatureChart } from "@/components/curetrack/temperature-chart";
import { CorrectionDialog } from "@/components/curetrack/correction-dialog";
import { can } from "@/lib/curetrack/permissions";
import { flagAttention } from "@/lib/curetrack/actions";
import { buildPatientView, canViewPatient, dischargeChecks, staffName } from "@/lib/curetrack/selectors";
import { perform, useAppState, useCurrentUser, useNow } from "@/lib/curetrack/store";
import { fmtDate, fmtDateTime } from "@/lib/curetrack/format";
import type { TemperatureReading } from "@/lib/curetrack/types";
import { differenceInCalendarDays, parseISO } from "date-fns";

export const Route = createFileRoute("/_console/patients/$patientId")({
  head: ({ params }) => ({
    meta: [
      { title: `Patient ${params.patientId} — CureTrack` },
      { name: "description", content: "Patient profile with temperature history, doctor visits and recovery progress." },
      { property: "og:title", content: `Patient ${params.patientId} — CureTrack` },
      { property: "og:description", content: "Patient record, temperature trend and discharge eligibility." },
    ],
  }),
  component: PatientProfile,
});

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function PatientProfile() {
  const { patientId } = Route.useParams();
  const state = useAppState();
  const user = useCurrentUser();
  const now = useNow();
  const [correcting, setCorrecting] = useState<TemperatureReading | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagError, setFlagError] = useState<string | null>(null);
  const patient = state.patients.find((p) => p.id === patientId);

  if (!patient)
    return (
      <Panel className="mx-auto mt-10 max-w-lg">
        <EmptyState icon={XCircle} title="Patient not found">
          No record with ID {patientId}. <Link to="/patients" className="text-primary hover:underline">Back to patients</Link>
        </EmptyState>
      </Panel>
    );
  if (!canViewPatient(user, patient)) return <AccessDenied what="view patients who are not assigned to you" />;

  const v = buildPatientView(state, patient, now);
  const t = state.settings.feverThreshold;
  const checks = dischargeChecks(v);
  const stay = differenceInCalendarDays(parseISO(patient.dischargeDate ?? patient.deathDate ?? now.toISOString()), parseISO(patient.admissionDate));
  const canCorrect = v.active && can(user.role, "temperature:correct");

  return (
    <>
      <Link to="/patients" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Patients
      </Link>
      <PageHeader
        title={patient.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{patient.id}</span>·<span>{patient.age} yrs, {patient.gender}</span>·
            <span>Bed <span className="font-mono">{v.active ? v.bedNumber : `${patient.lastBedNumber} (released)`}</span></span>
            <StatusBadge status={v.displayStatus} />
          </span>
        }
        actions={
          v.active && (
            <>
              {can(user.role, "patient:flag") && !patient.attentionFlag && (
                <Button variant="outline" onClick={() => setFlagOpen(true)}><Flag /> Flag for attention</Button>
              )}
              {can(user.role, "temperature:record") && (
                <Button asChild variant={v.todayReading ? "outline" : "default"}>
                  <Link to="/temperature" search={{ patient: patient.id }}><Thermometer /> Record temperature</Link>
                </Button>
              )}
              {can(user.role, "visit:record") && (
                <Button asChild><Link to="/visits" search={{ patient: patient.id }}><Stethoscope /> Record visit</Link></Button>
              )}
              {can(user.role, "discharge:confirm") && (
                <Button asChild variant={checks.ok ? "success" : "outline"}><Link to="/discharge" search={{ patient: patient.id }}><LogOut /> Discharge</Link></Button>
              )}
            </>
          )
        }
      />

      {patient.attentionFlag && (
        <div className="mb-6 flex gap-3 rounded-lg border border-destructive/40 bg-critical-soft p-4 text-sm text-critical-strong">
          <Flag className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-semibold">Flagged for medical attention</div>
            <div>{patient.attentionFlag.reason}</div>
            <div className="mt-1 text-xs opacity-80">
              {staffName(state, patient.attentionFlag.by)} · {fmtDateTime(patient.attentionFlag.at)} · Cleared when a doctor records a visit.
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {v.recovery && (
            <Panel title="Recovery progress" description={`Requires ${v.recovery.required} completed consecutive days with readings below ${t.toFixed(1)}°C.`}>
              <RecoveryTimeline recovery={v.recovery} threshold={t} />
            </Panel>
          )}
          <Panel title="Temperature history" description={`${v.readings.length} readings · dashed line marks the ${t.toFixed(1)}°C fever threshold`}>
            {v.readings.length ? <TemperatureChart readings={v.readings} threshold={t} /> : <EmptyState icon={Thermometer} title="No readings yet" />}
          </Panel>
          <Panel title="Readings" bodyClassName="p-0">
            {v.readings.length === 0 ? (
              <EmptyState icon={Thermometer} title="No readings recorded" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Recorded</TableHead>
                      <TableHead>Temperature</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Observation / corrections</TableHead>
                      {canCorrect && <TableHead className="pr-4 text-right" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...v.readings].reverse().map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="pl-4 text-sm">{fmtDateTime(r.recordedAt)}</TableCell>
                        <TableCell><TempValue value={r.temperature} threshold={t} /></TableCell>
                        <TableCell><Badge variant={r.type === "routine" ? "neutral" : "info"}>{r.type === "routine" ? "Routine" : "Additional"}</Badge></TableCell>
                        <TableCell className="text-sm">{staffName(state, r.recordedBy)}</TableCell>
                        <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                          {r.observation && <div>{r.observation}</div>}
                          {r.corrections.map((c, i) => (
                            <div key={i} className="mt-1 flex items-start gap-1 text-warning-strong">
                              <History className="mt-0.5 size-3 shrink-0" />
                              <span>
                                Corrected {c.previousValue.toFixed(1)} → {c.newValue.toFixed(1)}°C by {staffName(state, c.by)}, {fmtDateTime(c.at)}: “{c.reason}”
                              </span>
                            </div>
                          ))}
                          {r.corrections.length > 0 && <div className="mt-0.5">Original entry: {r.originalTemperature.toFixed(1)}°C</div>}
                        </TableCell>
                        {canCorrect && (
                          <TableCell className="pr-4 text-right">
                            <Button size="sm" variant="ghost" onClick={() => setCorrecting(r)}><PencilLine /> Correct</Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
          <Panel title="Doctor visits" description={`${v.visits.length} recorded`} bodyClassName="p-0">
            {v.visits.length === 0 ? (
              <EmptyState icon={Stethoscope} title="No doctor visits yet" />
            ) : (
              <ul className="divide-y">
                {v.visits.map((vis) => (
                  <li key={vis.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{staffName(state, vis.doctorId)}</span>
                      <span className="text-muted-foreground">· {fmtDateTime(vis.visitDate)}</span>
                      {vis.emergencyOverride && <Badge variant="warning"><ShieldAlert className="mr-1 size-3" />Emergency override</Badge>}
                      {vis.decision === "medically_recovered" && <Badge variant="success">Medically recovered</Badge>}
                      {vis.decision === "continued_observation" && <Badge variant="warning">Continued observation</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-foreground">{vis.clinicalNotes}</p>
                    {vis.treatmentPlan && <p className="mt-0.5 text-sm text-muted-foreground"><span className="font-medium text-foreground">Plan:</span> {vis.treatmentPlan}</p>}
                    {vis.overrideReason && <p className="mt-1 text-xs text-warning-strong">Override reason: {vis.overrideReason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          {v.active && (
            <Panel title="Discharge eligibility">
              <ul className="space-y-2.5 text-sm">
                <CheckRow ok={checks.recoveryMet} label={`${v.recovery!.required} fever-free days completed`} detail={`${v.recovery!.completedDays} of ${v.recovery!.required}`} />
                <CheckRow ok={checks.doctorConfirmed} label="Doctor confirmed medically recovered"
                  detail={patient.clinicalDecisionBy ? `${staffName(state, patient.clinicalDecisionBy)} · ${fmtDateTime(patient.clinicalDecisionAt!)}` : "Pending"} />
                <CheckRow ok={false} pending label="Administrator confirms discharge" detail={checks.ok ? "Ready for admin confirmation" : "Waiting on the checks above"} />
              </ul>
            </Panel>
          )}
          <Panel title="Patient details">
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Contact">{patient.contact}</Detail>
              <Detail label="Emergency contact">{patient.emergencyContact}</Detail>
              <Detail label="Assigned nurse">{staffName(state, patient.assignedNurseId)}</Detail>
              <Detail label="Gender">{patient.gender}</Detail>
            </dl>
          </Panel>
          <Panel title="Admission">
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Admitted">{fmtDateTime(patient.admissionDate)}</Detail>
              <Detail label={patient.status === "admitted" ? "Days in facility" : "Length of stay"}>{stay} days</Detail>
              <Detail label="Current bed">{v.active ? <span className="font-mono">{v.bedNumber}</span> : "—"}</Detail>
              <Detail label="Latest temperature"><TempValue value={v.latest?.temperature} threshold={t} /></Detail>
              {patient.dischargeDate && <Detail label="Discharged">{fmtDateTime(patient.dischargeDate)}</Detail>}
              {patient.deathDate && <Detail label="Date of death">{fmtDate(patient.deathDate)}</Detail>}
            </dl>
          </Panel>
          <Panel title="Medical notes">
            <dl className="space-y-3">
              <Detail label="Presenting symptoms">{patient.symptoms}</Detail>
              <Detail label="Medical history">{patient.medicalHistory || "None recorded"}</Detail>
            </dl>
          </Panel>
        </div>
      </div>

      <CorrectionDialog reading={correcting} onClose={() => setCorrecting(null)} />
      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag {patient.name} for medical attention</DialogTitle>
            <DialogDescription>Doctors see flagged patients at the top of their alerts. The flag clears when a doctor records a visit.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const res = perform((s, a) => flagAttention(s, a, patient.id, flagReason), "Patient flagged for doctor review");
              if (res.ok) {
                setFlagOpen(false);
                setFlagReason("");
                setFlagError(null);
              } else setFlagError(res.error);
            }}
          >
            <div>
              <Label htmlFor="flag-reason">What needs attention?</Label>
              <Textarea id="flag-reason" className="mt-1.5" rows={3} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} placeholder="e.g. New shortness of breath, SpO2 92%" />
              <FieldError>{flagError}</FieldError>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFlagOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive"><AlertTriangle /> Flag patient</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CheckRow({ ok, label, detail, pending }: { ok: boolean; label: string; detail: string; pending?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
      ) : pending ? (
        <div className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/50" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-warning" />
      )}
      <div>
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
    </li>
  );
}
