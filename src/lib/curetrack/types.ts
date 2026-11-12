export type Role = "nurse" | "doctor" | "admin" | "head_doctor";

export const ROLE_LABELS: Record<Role, string> = {
  nurse: "Nurse",
  doctor: "Doctor",
  admin: "Administrator",
  head_doctor: "Head Doctor",
};

export interface Staff {
  id: string;
  name: string;
  role: Role;
  email: string;
  active: boolean;
  /** Demo accounts are used for role switching and cannot be re-roled. */
  demoAccount: boolean;
}

/** Stored lifecycle status. Clinical sub-states (fever, recovery) are derived. */
export type PatientStatus = "admitted" | "discharged" | "deceased";

export type ClinicalDecision = "none" | "continued_observation" | "medically_recovered";

export type Gender = "female" | "male" | "other";

export interface AttentionFlag {
  by: string;
  at: string;
  reason: string;
}

export interface Patient {
  id: string; // e.g. CT-1001
  name: string;
  age: number;
  gender: Gender;
  contact: string;
  emergencyContact: string;
  admissionDate: string; // ISO timestamp
  bedId: string | null;
  lastBedNumber: string | null;
  status: PatientStatus;
  symptoms: string;
  medicalHistory: string;
  dischargeDate: string | null;
  deathDate: string | null;
  assignedNurseId: string | null;
  clinicalDecision: ClinicalDecision;
  clinicalDecisionAt: string | null;
  clinicalDecisionBy: string | null;
  attentionFlag: AttentionFlag | null;
}

export type BedStatus = "available" | "occupied" | "reserved" | "unavailable";

export interface Bed {
  id: string;
  bedNumber: string; // e.g. A-01
  ward: string;
  status: BedStatus;
  patientId: string | null;
  note: string | null;
}

export interface TemperatureCorrection {
  previousValue: number;
  newValue: number;
  by: string;
  at: string;
  reason: string;
}

export type ReadingType = "routine" | "additional";

export interface TemperatureReading {
  id: string;
  patientId: string;
  /** Current effective value (after any corrections). */
  temperature: number;
  /** Value as first entered; never changes. */
  originalTemperature: number;
  type: ReadingType;
  recordedBy: string;
  recordedAt: string;
  observation: string;
  corrections: TemperatureCorrection[];
}

export interface DoctorVisit {
  id: string;
  patientId: string;
  doctorId: string;
  visitDate: string;
  clinicalNotes: string;
  treatmentPlan: string;
  decision: ClinicalDecision;
  emergencyOverride: boolean;
  overrideReason: string | null;
}

export type AuditAction =
  | "patient_registered"
  | "bed_allocated"
  | "bed_status_changed"
  | "bed_released"
  | "temperature_recorded"
  | "temperature_corrected"
  | "doctor_visit"
  | "emergency_override"
  | "clinical_decision"
  | "attention_flagged"
  | "attention_cleared"
  | "discharge_confirmed"
  | "staff_added"
  | "role_changed"
  | "staff_status_changed"
  | "settings_changed"
  | "demo_reset";

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  role: Role;
  action: AuditAction;
  patientId: string | null;
  details: string;
  timestamp: string;
}

export interface HospitalSettings {
  capacity: number;
  feverThreshold: number;
  recoveryDays: number;
  tempMin: number;
  tempMax: number;
  lowBedThreshold: number;
}

export interface AppState {
  version: number;
  seededAt: string;
  settings: HospitalSettings;
  staff: Staff[];
  patients: Patient[];
  beds: Bed[];
  readings: TemperatureReading[];
  visits: DoctorVisit[];
  audit: AuditEntry[];
}

export const MAX_CAPACITY = 74;

export const DEFAULT_SETTINGS: HospitalSettings = {
  capacity: MAX_CAPACITY,
  feverThreshold: 37.8,
  recoveryDays: 3,
  tempMin: 34,
  tempMax: 42,
  lowBedThreshold: 8,
};
