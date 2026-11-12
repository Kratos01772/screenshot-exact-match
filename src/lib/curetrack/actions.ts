import { parseISO, startOfDay } from "date-fns";
import { assertCan, PermissionError, RuleError } from "./permissions";
import { dayKey } from "./recovery";
import { buildPatientView, canViewPatient, dischargeChecks } from "./selectors";
import type {
  AppState,
  AuditAction,
  BedStatus,
  ClinicalDecision,
  Gender,
  HospitalSettings,
  Patient,
  Role,
  Staff,
  TemperatureReading,
} from "./types";
import { MAX_CAPACITY } from "./types";

let counter = 0;
export function uid(prefix: string) {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function audit(
  state: AppState,
  actor: Staff,
  action: AuditAction,
  details: string,
  patientId: string | null = null,
  now = new Date(),
): AppState {
  return {
    ...state,
    audit: [
      {
        id: uid("log"),
        userId: actor.id,
        userName: actor.name,
        role: actor.role,
        action,
        patientId,
        details,
        timestamp: now.toISOString(),
      },
      ...state.audit,
    ],
  };
}

function getActivePatient(state: AppState, patientId: string) {
  const p = state.patients.find((x) => x.id === patientId);
  if (!p) throw new RuleError("Patient not found.");
  if (p.status !== "admitted") throw new RuleError(`${p.name} is not currently admitted.`);
  return p;
}

function updatePatient(state: AppState, id: string, patch: Partial<Patient>): AppState {
  return { ...state, patients: state.patients.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

function assertActive(actor: Staff) {
  if (!actor.active) throw new PermissionError("This staff account is deactivated.");
}

/* ------------------------------ Registration ------------------------------ */

export interface RegistrationInput {
  name: string;
  age: number;
  gender: Gender | "";
  contact: string;
  emergencyContact: string;
  admissionDate: string; // yyyy-MM-dd
  symptoms: string;
  medicalHistory: string;
  bedId: string;
  assignedNurseId: string | null;
}

export type FieldErrors = Partial<Record<keyof RegistrationInput, string>>;

export function validateRegistration(state: AppState, input: RegistrationInput, now = new Date()) {
  const e: FieldErrors = {};
  if (input.name.trim().length < 2) e.name = "Enter the patient's full name.";
  if (!Number.isInteger(input.age) || input.age < 0 || input.age > 120)
    e.age = "Enter an age between 0 and 120.";
  if (!input.gender) e.gender = "Select a gender.";
  if (input.contact.replace(/\D/g, "").length < 7) e.contact = "Enter a valid contact number.";
  if (input.emergencyContact.trim().length < 3)
    e.emergencyContact = "Enter an emergency contact name and number.";
  if (!input.admissionDate) e.admissionDate = "Select the admission date.";
  else if (startOfDay(parseISO(input.admissionDate)) > startOfDay(now))
    e.admissionDate = "Admission date cannot be in the future.";
  if (input.symptoms.trim().length < 3) e.symptoms = "Describe the presenting symptoms.";
  const bed = state.beds.find((b) => b.id === input.bedId);
  if (!input.bedId) e.bedId = "Select an available bed.";
  else if (!bed || bed.status !== "available" || bed.patientId)
    e.bedId = "This bed is no longer available. Choose another bed.";
  else if (state.patients.some((p) => p.status === "admitted" && p.bedId === input.bedId))
    e.bedId = "This bed is already allocated to an active patient.";
  return e;
}

export function registerPatient(state: AppState, actor: Staff, input: RegistrationInput, now = new Date()) {
  assertActive(actor);
  assertCan(actor.role, "patient:register", "register patients");
  const errors = validateRegistration(state, input, now);
  if (Object.keys(errors).length) throw new RuleError(Object.values(errors)[0]!);
  const occupied = state.beds.filter((b) => b.status === "occupied").length;
  if (occupied >= Math.min(state.settings.capacity, MAX_CAPACITY))
    throw new RuleError(`Facility is at full capacity (${state.settings.capacity} beds).`);

  const numbers = state.patients.map((p) => Number(p.id.replace(/\D/g, ""))).filter(Boolean);
  const id = `CT-${Math.max(1000, ...numbers) + 1}`;
  const bed = state.beds.find((b) => b.id === input.bedId)!;
  const admission =
    input.admissionDate === dayKey(now)
      ? now
      : new Date(`${input.admissionDate}T12:00:00`);
  const patient: Patient = {
    id,
    name: input.name.trim(),
    age: input.age,
    gender: input.gender as Gender,
    contact: input.contact.trim(),
    emergencyContact: input.emergencyContact.trim(),
    admissionDate: admission.toISOString(),
    bedId: bed.id,
    lastBedNumber: bed.bedNumber,
    status: "admitted",
    symptoms: input.symptoms.trim(),
    medicalHistory: input.medicalHistory.trim(),
    dischargeDate: null,
    deathDate: null,
    assignedNurseId: input.assignedNurseId,
    clinicalDecision: "none",
    clinicalDecisionAt: null,
    clinicalDecisionBy: null,
    attentionFlag: null,
  };
  let next: AppState = {
    ...state,
    patients: [...state.patients, patient],
    beds: state.beds.map((b) =>
      b.id === bed.id ? { ...b, status: "occupied" as BedStatus, patientId: id, note: null } : b,
    ),
  };
  next = audit(next, actor, "patient_registered", `Registered ${patient.name} (${id})`, id, now);
  next = audit(next, actor, "bed_allocated", `Allocated bed ${bed.bedNumber} to ${patient.name}`, id, now);
  return { state: next, patient };
}

/* ------------------------------ Temperatures ------------------------------ */

export interface TemperatureInput {
  patientId: string;
  temperature: number;
  observation: string;
  type: "routine" | "additional";
}

export function temperatureWarnings(t: number, settings: HospitalSettings) {
  const w: { level: "critical" | "warning"; message: string }[] = [];
  if (t >= 40) w.push({ level: "critical", message: "Very high temperature — escalate to a doctor immediately." });
  else if (t >= settings.feverThreshold)
    w.push({ level: "warning", message: `Fever: at or above the ${settings.feverThreshold.toFixed(1)}°C threshold. This resets the recovery streak.` });
  if (t < 35.5) w.push({ level: "critical", message: "Unusually low temperature — recheck and escalate if confirmed." });
  return w;
}

function validateTemp(t: number, settings: HospitalSettings) {
  if (!Number.isFinite(t)) throw new RuleError("Enter a temperature in °C.");
  if (t < settings.tempMin || t > settings.tempMax)
    throw new RuleError(
      `Temperature must be between ${settings.tempMin}°C and ${settings.tempMax}°C. Check the reading and re-enter.`,
    );
}

function invalidateRecoveryOnFever(state: AppState, patient: Patient, t: number): [AppState, string] {
  if (t >= state.settings.feverThreshold && patient.clinicalDecision === "medically_recovered") {
    return [
      updatePatient(state, patient.id, { clinicalDecision: "none", clinicalDecisionAt: null, clinicalDecisionBy: null }),
      " Previous recovery confirmation withdrawn due to fever.",
    ];
  }
  return [state, ""];
}

export function recordTemperature(state: AppState, actor: Staff, input: TemperatureInput, now = new Date()) {
  assertActive(actor);
  assertCan(actor.role, "temperature:record", "record temperatures");
  const patient = getActivePatient(state, input.patientId);
  if (!canViewPatient(actor, patient))
    throw new PermissionError(`${patient.name} is not assigned to you.`);
  const t = Math.round(input.temperature * 10) / 10;
  validateTemp(t, state.settings);
  const today = dayKey(now);
  const existing = state.readings.find(
    (r) => r.patientId === patient.id && r.type === "routine" && dayKey(r.recordedAt) === today,
  );
  if (input.type === "routine" && existing)
    throw new RuleError(
      `A routine reading (${existing.temperature.toFixed(1)}°C) was already recorded today. Use a correction to fix it, or record an additional check with an observation.`,
    );
  if (input.type === "additional" && input.observation.trim().length < 5)
    throw new RuleError("Additional checks need an observation explaining why the extra reading was taken.");

  const reading: TemperatureReading = {
    id: uid("tmp"),
    patientId: patient.id,
    temperature: t,
    originalTemperature: t,
    type: input.type,
    recordedBy: actor.id,
    recordedAt: now.toISOString(),
    observation: input.observation.trim(),
    corrections: [],
  };
  let next: AppState = { ...state, readings: [...state.readings, reading] };
  const [withFever, note] = invalidateRecoveryOnFever(next, patient, t);
  next = audit(
    withFever,
    actor,
    "temperature_recorded",
    `${input.type === "routine" ? "Routine" : "Additional"} reading ${t.toFixed(1)}°C for ${patient.name}.${note}`,
    patient.id,
    now,
  );
  return { state: next, reading, warnings: temperatureWarnings(t, state.settings) };
}

export function correctTemperature(
  state: AppState,
  actor: Staff,
  input: { readingId: string; newValue: number; reason: string },
  now = new Date(),
) {
  assertActive(actor);
  assertCan(actor.role, "temperature:correct", "correct temperature readings");
  const reading = state.readings.find((r) => r.id === input.readingId);
  if (!reading) throw new RuleError("Reading not found.");
  const patient = getActivePatient(state, reading.patientId);
  if (!canViewPatient(actor, patient)) throw new PermissionError(`${patient.name} is not assigned to you.`);
  const v = Math.round(input.newValue * 10) / 10;
  validateTemp(v, state.settings);
  if (v === reading.temperature) throw new RuleError("The corrected value is the same as the current value.");
  if (input.reason.trim().length < 5) throw new RuleError("Give a reason for the correction (at least 5 characters).");
  const updated: TemperatureReading = {
    ...reading,
    temperature: v,
    corrections: [
      ...reading.corrections,
      { previousValue: reading.temperature, newValue: v, by: actor.id, at: now.toISOString(), reason: input.reason.trim() },
    ],
  };
  let next: AppState = { ...state, readings: state.readings.map((r) => (r.id === reading.id ? updated : r)) };
  const [withFever, note] = invalidateRecoveryOnFever(next, patient, v);
  next = audit(
    withFever,
    actor,
    "temperature_corrected",
    `Corrected ${reading.temperature.toFixed(1)}°C → ${v.toFixed(1)}°C for ${patient.name} (original ${reading.originalTemperature.toFixed(1)}°C). Reason: ${input.reason.trim()}.${note}`,
    patient.id,
    now,
  );
  return { state: next, reading: updated };
}

export function flagAttention(state: AppState, actor: Staff, patientId: string, reason: string, now = new Date()) {
  assertActive(actor);
  assertCan(actor.role, "patient:flag", "flag patients");
  const patient = getActivePatient(state, patientId);
  if (!canViewPatient(actor, patient)) throw new PermissionError(`${patient.name} is not assigned to you.`);
  if (reason.trim().length < 5) throw new RuleError("Describe why the patient needs attention.");
  let next = updatePatient(state, patientId, { attentionFlag: { by: actor.id, at: now.toISOString(), reason: reason.trim() } });
  next = audit(next, actor, "attention_flagged", `Flagged ${patient.name} for medical attention: ${reason.trim()}`, patientId, now);
  return { state: next };
}

/* ------------------------------ Doctor visits ----------------------------- */

export interface VisitInput {
  patientId: string;
  clinicalNotes: string;
  treatmentPlan: string;
  decision: ClinicalDecision;
  emergencyOverride: boolean;
  overrideReason: string;
}

export function recordVisit(state: AppState, actor: Staff, input: VisitInput, now = new Date()) {
  assertActive(actor);
  assertCan(actor.role, "visit:record", "record doctor visits");
  const patient = getActivePatient(state, input.patientId);
  const view = buildPatientView(state, patient, now);
  if (!view.todayReading && !input.emergencyOverride)
    throw new RuleError(
      "Today's temperature has not been recorded. The nurse must record it before a routine visit. Use an emergency override only for exceptional situations.",
    );
  if (input.emergencyOverride) {
    assertCan(actor.role, "visit:override", "use the emergency override");
    if (input.overrideReason.trim().length < 10)
      throw new RuleError("An emergency override needs a reason of at least 10 characters.");
  }
  if (input.clinicalNotes.trim().length < 5) throw new RuleError("Add clinical observations for this visit.");
  if (input.decision === "medically_recovered" && !view.recovery?.eligible)
    throw new RuleError(
      `Cannot mark as medically recovered: ${view.recovery?.completedDays ?? 0} of ${state.settings.recoveryDays} fever-free days completed.`,
    );
  const visit = {
    id: uid("vis"),
    patientId: patient.id,
    doctorId: actor.id,
    visitDate: now.toISOString(),
    clinicalNotes: input.clinicalNotes.trim(),
    treatmentPlan: input.treatmentPlan.trim(),
    decision: input.decision,
    emergencyOverride: input.emergencyOverride,
    overrideReason: input.emergencyOverride ? input.overrideReason.trim() : null,
  };
  let next: AppState = { ...state, visits: [...state.visits, visit] };
  const patch: Partial<Patient> = { attentionFlag: null };
  if (input.decision !== "none") {
    patch.clinicalDecision = input.decision;
    patch.clinicalDecisionAt = now.toISOString();
    patch.clinicalDecisionBy = actor.id;
  }
  next = updatePatient(next, patient.id, patch);
  if (input.emergencyOverride)
    next = audit(next, actor, "emergency_override", `Emergency visit for ${patient.name} without today's temperature. Reason: ${input.overrideReason.trim()}`, patient.id, now);
  next = audit(next, actor, "doctor_visit", `${input.emergencyOverride ? "Emergency" : "Routine"} visit recorded for ${patient.name}`, patient.id, now);
  if (input.decision !== "none")
    next = audit(
      next,
      actor,
      "clinical_decision",
      `${patient.name} marked as ${input.decision === "medically_recovered" ? "medically recovered" : "requiring continued observation"}`,
      patient.id,
      now,
    );
  return { state: next, visit };
}

/* -------------------------------- Discharge ------------------------------- */

export function confirmDischarge(state: AppState, actor: Staff, patientId: string, now = new Date()) {
  assertActive(actor);
  assertCan(actor.role, "discharge:confirm", "confirm discharges");
  const patient = getActivePatient(state, patientId);
  const checks = dischargeChecks(buildPatientView(state, patient, now));
  if (!checks.ok) throw new RuleError(`Discharge blocked. ${checks.problems.join(" ")}`);
  const bed = state.beds.find((b) => b.id === patient.bedId);
  let next = updatePatient(state, patient.id, {
    status: "discharged",
    dischargeDate: now.toISOString(),
    bedId: null,
    lastBedNumber: bed?.bedNumber ?? patient.lastBedNumber,
    attentionFlag: null,
  });
  if (bed)
    next = {
      ...next,
      beds: next.beds.map((b) => (b.id === bed.id ? { ...b, status: "available" as BedStatus, patientId: null } : b)),
    };
  next = audit(next, actor, "discharge_confirmed", `Discharged ${patient.name} (${patient.id})`, patient.id, now);
  if (bed) next = audit(next, actor, "bed_released", `Released bed ${bed.bedNumber}`, patient.id, now);
  return { state: next };
}

/* ---------------------------------- Beds ---------------------------------- */

export function setBedStatus(
  state: AppState,
  actor: Staff,
  bedId: string,
  status: Exclude<BedStatus, "occupied">,
  note: string,
  now = new Date(),
) {
  assertActive(actor);
  assertCan(actor.role, "bed:manage", "change bed status");
  const bed = state.beds.find((b) => b.id === bedId);
  if (!bed) throw new RuleError("Bed not found.");
  if (bed.status === "occupied" || bed.patientId)
    throw new RuleError(`Bed ${bed.bedNumber} is occupied. Discharge the patient before changing its status.`);
  if (status !== "available" && note.trim().length < 3) throw new RuleError("Add a short note explaining why.");
  let next: AppState = {
    ...state,
    beds: state.beds.map((b) => (b.id === bedId ? { ...b, status, note: status === "available" ? null : note.trim() } : b)),
  };
  next = audit(next, actor, "bed_status_changed", `Bed ${bed.bedNumber}: ${bed.status} → ${status}${note.trim() ? ` (${note.trim()})` : ""}`, null, now);
  return { state: next };
}

/* ------------------------------ Staff & settings -------------------------- */

export function addStaff(state: AppState, actor: Staff, input: { name: string; email: string; role: Role }, now = new Date()) {
  assertActive(actor);
  assertCan(actor.role, "staff:manage", "manage staff");
  if (input.name.trim().length < 2) throw new RuleError("Enter the staff member's name.");
  if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) throw new RuleError("Enter a valid email address.");
  if (state.staff.some((s) => s.email.toLowerCase() === input.email.trim().toLowerCase()))
    throw new RuleError("A staff member with this email already exists.");
  const member: Staff = { id: uid("stf"), name: input.name.trim(), email: input.email.trim(), role: input.role, active: true, demoAccount: false };
  let next: AppState = { ...state, staff: [...state.staff, member] };
  next = audit(next, actor, "staff_added", `Added ${member.name} as ${input.role.replace("_", " ")}`, null, now);
  return { state: next };
}

export function changeRole(state: AppState, actor: Staff, staffId: string, role: Role, now = new Date()) {
  assertActive(actor);
  assertCan(actor.role, "staff:manage", "change staff roles");
  const member = state.staff.find((s) => s.id === staffId);
  if (!member) throw new RuleError("Staff member not found.");
  if (member.demoAccount) throw new RuleError("Demo accounts keep their role so every role stays available for the demo.");
  if (member.role === role) return { state };
  if (member.role === "nurse" && state.patients.some((p) => p.status === "admitted" && p.assignedNurseId === member.id))
    throw new RuleError(`${member.name} still has assigned patients. Reassign them before changing role.`);
  let next: AppState = { ...state, staff: state.staff.map((s) => (s.id === staffId ? { ...s, role } : s)) };
  next = audit(next, actor, "role_changed", `${member.name}: ${member.role.replace("_", " ")} → ${role.replace("_", " ")}`, null, now);
  return { state: next };
}

export function setStaffActive(state: AppState, actor: Staff, staffId: string, active: boolean, now = new Date()) {
  assertActive(actor);
  assertCan(actor.role, "staff:manage", "manage staff");
  const member = state.staff.find((s) => s.id === staffId);
  if (!member) throw new RuleError("Staff member not found.");
  if (member.demoAccount) throw new RuleError("Demo accounts cannot be deactivated.");
  if (!active && state.patients.some((p) => p.status === "admitted" && p.assignedNurseId === member.id))
    throw new RuleError(`${member.name} still has assigned patients.`);
  let next: AppState = { ...state, staff: state.staff.map((s) => (s.id === staffId ? { ...s, active } : s)) };
  next = audit(next, actor, "staff_status_changed", `${member.name} ${active ? "reactivated" : "deactivated"}`, null, now);
  return { state: next };
}

export function updateSettings(
  state: AppState,
  actor: Staff,
  patch: Partial<Pick<HospitalSettings, "feverThreshold" | "recoveryDays" | "tempMin" | "tempMax" | "lowBedThreshold">>,
  now = new Date(),
) {
  assertActive(actor);
  assertCan(actor.role, "settings:manage", "change hospital settings");
  const s = { ...state.settings, ...patch };
  if (!(s.feverThreshold >= 37 && s.feverThreshold <= 39.5)) throw new RuleError("Fever threshold must be between 37.0°C and 39.5°C.");
  if (!Number.isInteger(s.recoveryDays) || s.recoveryDays < 1 || s.recoveryDays > 14) throw new RuleError("Recovery days must be a whole number from 1 to 14.");
  if (!(s.tempMin >= 30 && s.tempMax <= 45 && s.tempMin < s.tempMax)) throw new RuleError("Valid range must be within 30–45°C with minimum below maximum.");
  if (!(s.feverThreshold > s.tempMin && s.feverThreshold < s.tempMax)) throw new RuleError("Fever threshold must sit inside the valid range.");
  if (!Number.isInteger(s.lowBedThreshold) || s.lowBedThreshold < 0 || s.lowBedThreshold > s.capacity) throw new RuleError("Low-bed alert must be between 0 and capacity.");
  const changes = (Object.keys(patch) as (keyof typeof patch)[])
    .filter((k) => state.settings[k] !== s[k])
    .map((k) => `${k}: ${state.settings[k]} → ${s[k]}`);
  if (!changes.length) return { state };
  let next: AppState = { ...state, settings: s };
  next = audit(next, actor, "settings_changed", `Settings updated — ${changes.join(", ")}`, null, now);
  return { state: next };
}
