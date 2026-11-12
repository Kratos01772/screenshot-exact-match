import { parseISO } from "date-fns";
import { computeRecovery, dayKey, type RecoveryResult } from "./recovery";
import type { AppState, DoctorVisit, Patient, Role, Staff, TemperatureReading } from "./types";

export type DisplayStatus =
  | "admitted"
  | "under_observation"
  | "fever"
  | "recovery_tracking"
  | "eligible"
  | "discharged"
  | "deceased";

export const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  admitted: "Admitted",
  under_observation: "Under observation",
  fever: "Fever detected",
  recovery_tracking: "Recovery tracking",
  eligible: "Eligible for discharge",
  discharged: "Discharged",
  deceased: "Deceased",
};

export interface PatientView {
  patient: Patient;
  readings: TemperatureReading[]; // oldest first
  visits: DoctorVisit[]; // newest first
  latest: TemperatureReading | null;
  todayReading: TemperatureReading | null;
  todayVisit: DoctorVisit | null;
  recovery: RecoveryResult | null;
  isFever: boolean;
  displayStatus: DisplayStatus;
  bedNumber: string | null;
  active: boolean;
  approaching: boolean;
}

export function buildPatientView(state: AppState, patient: Patient, now = new Date()): PatientView {
  const { feverThreshold, recoveryDays } = state.settings;
  const readings = state.readings
    .filter((r) => r.patientId === patient.id)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const visits = state.visits
    .filter((v) => v.patientId === patient.id)
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  const today = dayKey(now);
  const latest = readings.at(-1) ?? null;
  const todayReading =
    [...readings].reverse().find((r) => dayKey(r.recordedAt) === today) ?? null;
  const todayVisit = visits.find((v) => dayKey(v.visitDate) === today) ?? null;
  const active = patient.status === "admitted";
  const recovery = active
    ? computeRecovery(readings, patient.admissionDate, feverThreshold, recoveryDays, now)
    : null;
  const isFever = !!latest && latest.temperature >= feverThreshold;
  const bed = patient.bedId ? state.beds.find((b) => b.id === patient.bedId) : null;

  let displayStatus: DisplayStatus;
  if (patient.status === "discharged") displayStatus = "discharged";
  else if (patient.status === "deceased") displayStatus = "deceased";
  else if (recovery?.eligible) displayStatus = "eligible";
  else if (isFever) displayStatus = "fever";
  else if (patient.clinicalDecision === "continued_observation") displayStatus = "under_observation";
  else if ((recovery?.completedDays ?? 0) > 0) displayStatus = "recovery_tracking";
  else displayStatus = "admitted";

  return {
    patient,
    readings,
    visits,
    latest,
    todayReading,
    todayVisit,
    recovery,
    isFever,
    displayStatus,
    bedNumber: bed?.bedNumber ?? patient.lastBedNumber,
    active,
    approaching:
      !!recovery && !recovery.eligible && recovery.completedDays === recovery.required - 1,
  };
}

export function allPatientViews(state: AppState, now = new Date()) {
  return state.patients.map((p) => buildPatientView(state, p, now));
}

/** Patients a user is allowed to see. Nurses only see patients assigned to them. */
export function visiblePatientViews(state: AppState, user: Staff, now = new Date()) {
  const views = allPatientViews(state, now);
  if (user.role === "nurse") return views.filter((v) => v.patient.assignedNurseId === user.id);
  return views;
}

export function canViewPatient(user: Staff, patient: Patient) {
  return user.role !== "nurse" || patient.assignedNurseId === user.id;
}

export type FilterKey =
  | "all"
  | "admitted"
  | "under_observation"
  | "fever"
  | "recovery_tracking"
  | "eligible"
  | "discharged"
  | "deceased";

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All patients" },
  { key: "admitted", label: "Admitted" },
  { key: "under_observation", label: "Under observation" },
  { key: "fever", label: "Fever detected" },
  { key: "recovery_tracking", label: "Recovery tracking" },
  { key: "eligible", label: "Eligible for discharge" },
  { key: "discharged", label: "Discharged" },
  { key: "deceased", label: "Deceased" },
];

export function matchesFilter(v: PatientView, f: FilterKey): boolean {
  switch (f) {
    case "all":
      return true;
    case "admitted":
      return v.active;
    case "under_observation":
      return v.active && v.patient.clinicalDecision === "continued_observation";
    case "fever":
      return v.active && v.isFever;
    case "recovery_tracking":
      return (
        v.active &&
        !!v.recovery &&
        !v.recovery.eligible &&
        v.recovery.completedDays > 0
      );
    case "eligible":
      return v.active && !!v.recovery?.eligible;
    case "discharged":
      return v.patient.status === "discharged";
    case "deceased":
      return v.patient.status === "deceased";
  }
}

/** A discharge needs recovery criteria met and the doctor's confirmation. */
export function dischargeChecks(v: PatientView) {
  const recoveryMet = !!v.recovery?.eligible;
  const doctorConfirmed = v.patient.clinicalDecision === "medically_recovered";
  const problems: string[] = [];
  if (!v.active) problems.push("Patient is not currently admitted.");
  if (!recoveryMet)
    problems.push(
      `Recovery criteria not met: ${v.recovery?.completedDays ?? 0} of ${v.recovery?.required ?? 3} fever-free days completed.`,
    );
  if (!doctorConfirmed) problems.push("A doctor has not confirmed the patient as medically recovered.");
  return { recoveryMet, doctorConfirmed, ok: problems.length === 0, problems };
}

export type NotificationKind =
  | "missing_reading"
  | "elevated"
  | "pending_visit"
  | "approaching"
  | "eligible"
  | "low_beds"
  | "attention";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  patientId: string | null;
}

const ROLE_KINDS: Record<Role, NotificationKind[]> = {
  nurse: ["missing_reading", "elevated", "approaching"],
  doctor: ["elevated", "attention", "pending_visit", "missing_reading", "eligible", "approaching"],
  admin: ["low_beds", "eligible"],
  head_doctor: ["elevated", "attention", "low_beds", "eligible", "missing_reading", "pending_visit", "approaching"],
};

export function notificationsFor(state: AppState, user: Staff, now = new Date()): AppNotification[] {
  const views = visiblePatientViews(state, user, now).filter((v) => v.active);
  const kinds = ROLE_KINDS[user.role];
  const out: AppNotification[] = [];
  const t = state.settings.feverThreshold;
  for (const v of views) {
    const label = `${v.patient.name} · Bed ${v.bedNumber ?? "—"}`;
    if (v.todayReading && v.todayReading.temperature >= t)
      out.push({
        id: `elevated-${v.patient.id}`,
        kind: "elevated",
        severity: "critical",
        title: `Elevated temperature: ${v.todayReading.temperature.toFixed(1)}°C`,
        description: label,
        patientId: v.patient.id,
      });
    if (v.patient.attentionFlag)
      out.push({
        id: `attention-${v.patient.id}`,
        kind: "attention",
        severity: "critical",
        title: "Flagged for medical attention",
        description: `${label} — ${v.patient.attentionFlag.reason}`,
        patientId: v.patient.id,
      });
    if (!v.todayReading)
      out.push({
        id: `missing-${v.patient.id}`,
        kind: "missing_reading",
        severity: "warning",
        title: "Today's temperature not recorded",
        description: label,
        patientId: v.patient.id,
      });
    if (v.todayReading && !v.todayVisit)
      out.push({
        id: `visit-${v.patient.id}`,
        kind: "pending_visit",
        severity: "info",
        title: "Ready for doctor visit",
        description: `${label} — temperature recorded`,
        patientId: v.patient.id,
      });
    if (v.recovery?.eligible)
      out.push({
        id: `eligible-${v.patient.id}`,
        kind: "eligible",
        severity: "success",
        title:
          v.patient.clinicalDecision === "medically_recovered"
            ? "Ready for discharge"
            : "Recovery criteria met — awaiting doctor confirmation",
        description: label,
        patientId: v.patient.id,
      });
    if (v.approaching)
      out.push({
        id: `approaching-${v.patient.id}`,
        kind: "approaching",
        severity: "info",
        title: "Approaching recovery eligibility",
        description: `${label} — ${v.recovery!.completedDays} of ${v.recovery!.required} days`,
        patientId: v.patient.id,
      });
  }
  const available = state.beds.filter((b) => b.status === "available").length;
  if (available <= state.settings.lowBedThreshold)
    out.push({
      id: "low-beds",
      kind: "low_beds",
      severity: "warning",
      title: "Low bed availability",
      description: `${available} beds available of ${state.settings.capacity}`,
      patientId: null,
    });
  const order = { critical: 0, warning: 1, info: 2, success: 3 };
  return out.filter((n) => kinds.includes(n.kind)).sort((a, b) => order[a.severity] - order[b.severity]);
}

export function staffName(state: AppState, id: string | null | undefined) {
  if (!id) return "—";
  return state.staff.find((s) => s.id === id)?.name ?? "Unknown";
}

export function isSameDay(a: string, b: Date) {
  return dayKey(parseISO(a)) === dayKey(b);
}
