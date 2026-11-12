import { addDays, addMinutes, startOfDay } from "date-fns";
import type {
  AppState,
  AuditAction,
  AuditEntry,
  Bed,
  ClinicalDecision,
  DoctorVisit,
  Gender,
  Patient,
  Staff,
  TemperatureReading,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

export const STATE_VERSION = 3;

export const DEMO_STAFF: Staff[] = [
  { id: "stf-sarah", name: "Sarah Johnson", role: "nurse", email: "sarah.johnson@curetrack.health", active: true, demoAccount: true },
  { id: "stf-amir", name: "Dr. Amir Khan", role: "doctor", email: "amir.khan@curetrack.health", active: true, demoAccount: true },
  { id: "stf-priya", name: "Priya Sharma", role: "admin", email: "priya.sharma@curetrack.health", active: true, demoAccount: true },
  { id: "stf-elena", name: "Dr. Elena Reyes", role: "head_doctor", email: "elena.reyes@curetrack.health", active: true, demoAccount: true },
  { id: "stf-james", name: "James Okafor", role: "nurse", email: "james.okafor@curetrack.health", active: true, demoAccount: false },
  { id: "stf-lena", name: "Dr. Lena Novak", role: "doctor", email: "lena.novak@curetrack.health", active: true, demoAccount: false },
];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WARDS: [string, number][] = [
  ["A", 20],
  ["B", 20],
  ["C", 20],
  ["D", 14],
];

function makeBeds(): Bed[] {
  const beds: Bed[] = [];
  for (const [ward, count] of WARDS) {
    for (let i = 1; i <= count; i++) {
      const num = `${ward}-${String(i).padStart(2, "0")}`;
      beds.push({ id: `bed-${num}`, bedNumber: num, ward: `Ward ${ward}`, status: "available", patientId: null, note: null });
    }
  }
  return beds;
}

interface Scenario {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  admitDaysAgo: number;
  bed: string;
  nurse: string;
  /** Temperatures from admission day up to yesterday; null = missing reading. */
  hist: (number | null)[];
  today?: number;
  todayVisit?: { decision: ClinicalDecision; notes: string; plan: string };
  decision?: ClinicalDecision;
  flag?: string;
  symptoms: string;
  history: string;
  outcome?: { kind: "discharged" | "deceased"; daysAgo: number };
}

const SCENARIOS: Scenario[] = [
  { id: "CT-1001", name: "Daniel Mercer", age: 46, gender: "male", admitDaysAgo: 7, bed: "A-01", nurse: "stf-sarah", hist: [38.6, 38.4, 38.1, 37.9, 36.9, 36.8, 36.6], today: 36.5, todayVisit: { decision: "medically_recovered", notes: "Afebrile for three full days. Chest clear, SpO2 98% on room air. Appetite returned.", plan: "Fit for discharge. Home isolation advice given; GP follow-up in 7 days." }, symptoms: "Fever, dry cough, fatigue", history: "Mild asthma (salbutamol PRN)" },
  { id: "CT-1002", name: "Aisha Rahman", age: 34, gender: "female", admitDaysAgo: 6, bed: "A-02", nurse: "stf-sarah", hist: [38.9, 38.2, 37.9, 36.8, 36.7, 36.6], symptoms: "High fever, myalgia, headache", history: "No significant history" },
  { id: "CT-1003", name: "Mateo Alvarez", age: 58, gender: "male", admitDaysAgo: 8, bed: "A-04", nurse: "stf-sarah", hist: [39.1, 38.7, 38.3, 38.0, 37.2, 36.9, 36.8, 36.7], today: 36.6, symptoms: "Fever, shortness of breath on exertion", history: "Type 2 diabetes (metformin), hypertension" },
  { id: "CT-1004", name: "Grace Liu", age: 29, gender: "female", admitDaysAgo: 5, bed: "A-05", nurse: "stf-sarah", hist: [38.4, 38.2, 38.0, 37.1, 36.9], today: 36.8, symptoms: "Fever, sore throat, loss of smell", history: "None" },
  { id: "CT-1005", name: "Robert Hughes", age: 67, gender: "male", admitDaysAgo: 6, bed: "A-07", nurse: "stf-sarah", hist: [38.8, 38.5, 38.3, 37.9, 37.3, 37.0], symptoms: "Fever, productive cough, confusion on admission", history: "COPD, ex-smoker; atrial fibrillation (apixaban)" },
  { id: "CT-1006", name: "Fatima Noor", age: 41, gender: "female", admitDaysAgo: 4, bed: "A-08", nurse: "stf-sarah", hist: [38.6, 38.3, 38.0, 37.2], today: 37.0, symptoms: "Fever, chills, nausea", history: "Hypothyroidism (levothyroxine)" },
  { id: "CT-1007", name: "Liam O'Connor", age: 52, gender: "male", admitDaysAgo: 7, bed: "A-10", nurse: "stf-sarah", hist: [38.7, 38.2, 37.9, 37.3, 37.1, null, 36.9], today: 36.8, symptoms: "Fever, cough, chest tightness", history: "Hyperlipidaemia" },
  { id: "CT-1008", name: "Sofia Petrov", age: 38, gender: "female", admitDaysAgo: 6, bed: "B-01", nurse: "stf-sarah", hist: [38.5, 38.2, 38.0, 37.9, 37.2, 37.0], today: 38.4, flag: "Temperature spike to 38.4°C after two fever-free days; reports rigors.", symptoms: "Fever, body aches, diarrhoea", history: "None" },
  { id: "CT-1009", name: "Kwame Mensah", age: 61, gender: "male", admitDaysAgo: 4, bed: "B-03", nurse: "stf-sarah", hist: [38.9, 38.6, 38.4, 38.1], decision: "continued_observation", symptoms: "Persistent high fever, dyspnoea", history: "Chronic kidney disease stage 3" },
  { id: "CT-1010", name: "Hannah Weiss", age: 25, gender: "female", admitDaysAgo: 1, bed: "B-04", nurse: "stf-sarah", hist: [38.6], symptoms: "Fever, headache, photophobia (meningism excluded)", history: "None" },
  { id: "CT-1011", name: "Arjun Mehta", age: 49, gender: "male", admitDaysAgo: 0, bed: "B-06", nurse: "stf-sarah", hist: [], symptoms: "Fever 38.5°C at triage, cough, fatigue", history: "Hypertension (amlodipine)" },
  { id: "CT-1012", name: "Isabella Rossi", age: 72, gender: "female", admitDaysAgo: 9, bed: "C-02", nurse: "stf-james", hist: [38.2, 38.4, 38.0, 37.9, 38.1, 37.8, 38.0, 37.9, 38.0], today: 37.9, decision: "continued_observation", symptoms: "Fever, weakness, reduced oral intake", history: "Heart failure (EF 40%), osteoarthritis" },
  { id: "CT-1013", name: "Noah Fischer", age: 33, gender: "male", admitDaysAgo: 5, bed: "C-03", nurse: "stf-james", hist: [38.3, 38.1, 37.9, 37.3, 37.1], today: 37.0, todayVisit: { decision: "none", notes: "Improving. Afebrile 2 days, mild residual cough.", plan: "Continue supportive care; review tomorrow." }, symptoms: "Fever, cough", history: "None" },
  { id: "CT-1014", name: "Mei Tanaka", age: 44, gender: "female", admitDaysAgo: 3, bed: "C-05", nurse: "stf-james", hist: [38.4, 38.0, 37.4], today: 37.2, todayVisit: { decision: "none", notes: "Fever settling. Hydration improved.", plan: "Oral fluids, paracetamol PRN. Monitor." }, symptoms: "Fever, vomiting", history: "Migraine" },
  // Completed outcomes
  { id: "CT-0995", name: "Elena Kowalski", age: 55, gender: "female", admitDaysAgo: 18, bed: "A-03", nurse: "stf-sarah", hist: [38.7, 38.5, 38.4, 38.0, 37.9, 37.4, 37.0, 36.8, 36.7], outcome: { kind: "discharged", daysAgo: 9 }, symptoms: "Fever, cough", history: "None" },
  { id: "CT-0996", name: "Samuel Adeyemi", age: 39, gender: "male", admitDaysAgo: 15, bed: "A-06", nurse: "stf-sarah", hist: [38.9, 38.6, 38.2, 37.9, 37.2, 36.9, 36.8, 36.6, 36.6, 36.5], outcome: { kind: "discharged", daysAgo: 5 }, symptoms: "Fever, myalgia", history: "Sickle cell trait" },
  { id: "CT-0997", name: "Chloe Martin", age: 27, gender: "female", admitDaysAgo: 12, bed: "B-02", nurse: "stf-james", hist: [38.4, 38.1, 37.9, 37.3, 37.0, 36.8, 36.7, 36.6, 36.6], outcome: { kind: "discharged", daysAgo: 3 }, symptoms: "Fever, sore throat", history: "None" },
  { id: "CT-0998", name: "Omar Haddad", age: 63, gender: "male", admitDaysAgo: 10, bed: "B-05", nurse: "stf-sarah", hist: [38.8, 38.5, 38.2, 37.9, 37.1, 36.9, 36.8, 36.7, 36.6], outcome: { kind: "discharged", daysAgo: 1 }, symptoms: "Fever, breathlessness", history: "Hypertension" },
  { id: "CT-0993", name: "Margaret Ellis", age: 81, gender: "female", admitDaysAgo: 20, bed: "A-09", nurse: "stf-sarah", hist: [38.9, 39.2, 39.5, 39.8, 40.1, 40.3, 40.2], outcome: { kind: "deceased", daysAgo: 13 }, symptoms: "Fever, severe dyspnoea, confusion", history: "Dementia, CKD stage 4, diabetes" },
  { id: "CT-0994", name: "Viktor Sokolov", age: 76, gender: "male", admitDaysAgo: 14, bed: "C-01", nurse: "stf-james", hist: [38.6, 38.9, 39.3, 39.6, 39.9, 40.2, 40.4, 40.1], outcome: { kind: "deceased", daysAgo: 6 }, symptoms: "Fever, hypoxia", history: "Ischaemic heart disease, COPD" },
];

const VISIT_NOTES = [
  ["Febrile, haemodynamically stable. Chest auscultation unremarkable.", "Antipyretics, oral fluids, 4-hourly observations."],
  ["Temperature trending down. Tolerating diet.", "Continue current management."],
  ["Mild tachycardia, encouraged fluids. No new symptoms.", "IV fluids if oral intake poor; review tomorrow."],
  ["Comfortable at rest. SpO2 stable on room air.", "Continue supportive care."],
];

export function createSeedState(now: Date = new Date()): AppState {
  const rand = mulberry32(2026);
  const today = startOfDay(now);
  const latestToday = addMinutes(now, -20);
  const at = (daysAgo: number, hour: number, minute: number, clampMin = 20) => {
    const t = addMinutes(addDays(today, -daysAgo), hour * 60 + minute);
    if (daysAgo === 0) {
      const cap = addMinutes(now, -clampMin);
      const floor = addMinutes(today, 1);
      const v = t > cap ? cap : t;
      return v < floor ? floor : v;
    }
    return t;
  };

  const beds = makeBeds();
  const patients: Patient[] = [];
  const readings: TemperatureReading[] = [];
  const visits: DoctorVisit[] = [];
  const audit: AuditEntry[] = [];
  const staffById = new Map(DEMO_STAFF.map((s) => [s.id, s]));
  let logN = 0;
  const log = (userId: string, action: AuditAction, details: string, patientId: string | null, ts: Date) => {
    const u = staffById.get(userId)!;
    audit.push({ id: `log-seed-${++logN}`, userId, userName: u.name, role: u.role, action, patientId, details, timestamp: ts.toISOString() });
  };
  const doctors = ["stf-amir", "stf-lena"];

  for (const s of SCENARIOS) {
    const admission = at(s.admitDaysAgo, 7, Math.floor(rand() * 50), 60);
    const bed = beds.find((b) => b.bedNumber === s.bed)!;
    const active = !s.outcome;
    let decision: ClinicalDecision = s.decision ?? "none";
    let decisionAt: string | null = null;
    let decisionBy: string | null = null;

    log("stf-priya", "patient_registered", `Registered ${s.name} (${s.id})`, s.id, admission);
    log("stf-priya", "bed_allocated", `Allocated bed ${bed.bedNumber} to ${s.name}`, s.id, admission);

    s.hist.forEach((temp, idx) => {
      const daysAgo = s.admitDaysAgo - idx;
      if (s.outcome && daysAgo < s.outcome.daysAgo) return;
      if (temp == null) return;
      const ts = at(daysAgo, 8, 15 + Math.floor(rand() * 75));
      readings.push({ id: `tmp-seed-${s.id}-${idx}`, patientId: s.id, temperature: temp, originalTemperature: temp, type: "routine", recordedBy: s.nurse, recordedAt: ts.toISOString(), observation: temp >= 39 ? "Rigors, antipyretic given" : "", corrections: [] });
      log(s.nurse, "temperature_recorded", `Routine reading ${temp.toFixed(1)}°C for ${s.name}.`, s.id, ts);
      // Doctor rounds every other day on days with a reading (never on the outcome day).
      const isOutcomeDay = s.outcome && daysAgo === s.outcome.daysAgo;
      if (idx % 2 === 0 && !isOutcomeDay && daysAgo > 0) {
        const [notes, plan] = VISIT_NOTES[Math.floor(rand() * VISIT_NOTES.length)];
        const doc = doctors[Math.floor(rand() * 2)];
        const vts = at(daysAgo, 11, Math.floor(rand() * 90));
        const isLastHist = idx >= s.hist.length - 2;
        const d: ClinicalDecision = active && s.decision && isLastHist ? s.decision : "none";
        visits.push({ id: `vis-seed-${s.id}-${idx}`, patientId: s.id, doctorId: doc, visitDate: vts.toISOString(), clinicalNotes: notes, treatmentPlan: plan, decision: d, emergencyOverride: false, overrideReason: null });
        log(doc, "doctor_visit", `Routine visit recorded for ${s.name}`, s.id, vts);
        if (d !== "none") {
          decisionAt = vts.toISOString();
          decisionBy = doc;
          log(doc, "clinical_decision", `${s.name} marked as requiring continued observation`, s.id, vts);
        }
      }
    });

    if (active && s.today != null) {
      const ts = at(0, 8, 20 + Math.floor(rand() * 60));
      readings.push({ id: `tmp-seed-${s.id}-today`, patientId: s.id, temperature: s.today, originalTemperature: s.today, type: "routine", recordedBy: s.nurse, recordedAt: ts.toISOString(), observation: s.today >= 38 ? "Patient reports rigors" : "", corrections: [] });
      log(s.nurse, "temperature_recorded", `Routine reading ${s.today.toFixed(1)}°C for ${s.name}.`, s.id, ts);
      if (s.todayVisit) {
        const vts = at(0, 10, 30 + Math.floor(rand() * 40), 5);
        const v = s.todayVisit;
        visits.push({ id: `vis-seed-${s.id}-today`, patientId: s.id, doctorId: "stf-amir", visitDate: vts.toISOString(), clinicalNotes: v.notes, treatmentPlan: v.plan, decision: v.decision, emergencyOverride: false, overrideReason: null });
        log("stf-amir", "doctor_visit", `Routine visit recorded for ${s.name}`, s.id, vts);
        if (v.decision !== "none") {
          decision = v.decision;
          decisionAt = vts.toISOString();
          decisionBy = "stf-amir";
          log("stf-amir", "clinical_decision", `${s.name} marked as medically recovered`, s.id, vts);
        }
      }
    }

    // Liam O'Connor: emergency review on the day his routine reading was missed.
    if (s.id === "CT-1007") {
      const vts = at(2, 6, 40);
      visits.push({ id: "vis-seed-CT-1007-override", patientId: s.id, doctorId: "stf-lena", visitDate: vts.toISOString(), clinicalNotes: "Overnight chest tightness. ECG normal sinus rhythm, troponin negative.", treatmentPlan: "Analgesia, repeat obs 2-hourly.", decision: "none", emergencyOverride: true, overrideReason: "Patient reported chest tightness overnight; reviewed before the morning temperature round." });
      log("stf-lena", "emergency_override", "Emergency visit for Liam O'Connor without today's temperature. Reason: Patient reported chest tightness overnight; reviewed before the morning temperature round.", s.id, vts);
      log("stf-lena", "doctor_visit", "Emergency visit recorded for Liam O'Connor", s.id, vts);
    }

    let flag = null;
    if (s.flag) {
      const fts = at(0, 9, 10, 10);
      flag = { by: s.nurse, at: fts.toISOString(), reason: s.flag };
      log(s.nurse, "attention_flagged", `Flagged ${s.name} for medical attention: ${s.flag}`, s.id, fts);
    }

    let dischargeDate: string | null = null;
    let deathDate: string | null = null;
    if (s.outcome) {
      const ots = at(s.outcome.daysAgo, 14, Math.floor(rand() * 60));
      if (s.outcome.kind === "discharged") {
        const vts = at(s.outcome.daysAgo, 10, 15);
        visits.push({ id: `vis-seed-${s.id}-final`, patientId: s.id, doctorId: "stf-amir", visitDate: vts.toISOString(), clinicalNotes: "Afebrile for three full days. Clinically well.", treatmentPlan: "Medically fit for discharge.", decision: "medically_recovered", emergencyOverride: false, overrideReason: null });
        log("stf-amir", "doctor_visit", `Routine visit recorded for ${s.name}`, s.id, vts);
        log("stf-amir", "clinical_decision", `${s.name} marked as medically recovered`, s.id, vts);
        decision = "medically_recovered";
        decisionAt = vts.toISOString();
        decisionBy = "stf-amir";
        dischargeDate = ots.toISOString();
        log("stf-priya", "discharge_confirmed", `Discharged ${s.name} (${s.id})`, s.id, ots);
        log("stf-priya", "bed_released", `Released bed ${bed.bedNumber}`, s.id, ots);
      } else {
        deathDate = ots.toISOString();
      }
    }

    if (active) {
      bed.status = "occupied";
      bed.patientId = s.id;
    }
    patients.push({
      id: s.id,
      name: s.name,
      age: s.age,
      gender: s.gender,
      contact: `+44 7${String(700 + Math.floor(rand() * 299))} ${String(100000 + Math.floor(rand() * 899999))}`,
      emergencyContact: `${["Maria", "John", "Leila", "Tom", "Anna", "David"][Math.floor(rand() * 6)]} ${s.name.split(" ").at(-1)} · +44 7${String(700 + Math.floor(rand() * 299))} ${String(100000 + Math.floor(rand() * 899999))}`,
      admissionDate: admission.toISOString(),
      bedId: active ? bed.id : null,
      lastBedNumber: bed.bedNumber,
      status: s.outcome ? s.outcome.kind : "admitted",
      symptoms: s.symptoms,
      medicalHistory: s.history,
      dischargeDate,
      deathDate,
      assignedNurseId: s.nurse,
      clinicalDecision: decision,
      clinicalDecisionAt: decisionAt,
      clinicalDecisionBy: decisionBy,
      attentionFlag: flag,
    });
  }

  for (const [num, status, note] of [
    ["D-12", "reserved", "Reserved for transfer from City General"],
    ["D-13", "reserved", "Held for isolation step-down"],
    ["D-14", "unavailable", "Ventilation maintenance"],
  ] as const) {
    const b = beds.find((x) => x.bedNumber === num)!;
    b.status = status;
    b.note = note;
  }

  void latestToday;
  audit.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return {
    version: STATE_VERSION,
    seededAt: now.toISOString(),
    settings: { ...DEFAULT_SETTINGS },
    staff: DEMO_STAFF.map((s) => ({ ...s })),
    patients,
    beds,
    readings,
    visits,
    audit,
  };
}
