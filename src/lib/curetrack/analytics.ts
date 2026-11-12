import type { AppState, Patient } from "./types";
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { dayKey } from "./recovery";

export const MORTALITY_BENCHMARK = 15;
export const SURVIVAL_BENCHMARK = 85;

export interface OutcomeRates {
  completed: number;
  deceased: number;
  discharged: number;
  mortalityRate: number | null;
  survivalRate: number | null;
}

/** Uses completed outcomes only; active patients are excluded. */
export function outcomeRates(patients: Patient[]): OutcomeRates {
  const deceased = patients.filter((p) => p.status === "deceased").length;
  const discharged = patients.filter((p) => p.status === "discharged").length;
  const completed = deceased + discharged;
  if (completed === 0) {
    return { completed, deceased, discharged, mortalityRate: null, survivalRate: null };
  }
  return {
    completed,
    deceased,
    discharged,
    mortalityRate: (deceased / completed) * 100,
    survivalRate: (discharged / completed) * 100,
  };
}

export function bedSummary(state: AppState) {
  const occupied = state.beds.filter((b) => b.status === "occupied").length;
  const available = state.beds.filter((b) => b.status === "available").length;
  const held = state.beds.filter((b) => b.status === "reserved" || b.status === "unavailable").length;
  const capacity = state.settings.capacity;
  return {
    capacity,
    occupied,
    available,
    held,
    occupancyRate: capacity ? (occupied / capacity) * 100 : 0,
  };
}

/** Average length of stay in days for patients discharged alive. */
export function averageLengthOfStay(patients: Patient[]): number | null {
  const done = patients.filter((p) => p.status === "discharged" && p.dischargeDate);
  if (!done.length) return null;
  const total = done.reduce(
    (sum, p) =>
      sum + Math.max(1, differenceInCalendarDays(parseISO(p.dischargeDate!), parseISO(p.admissionDate))),
    0,
  );
  return total / done.length;
}


/** Admissions, discharges and deaths per calendar day for the last `days` days (today included). */
export function dailyFlow(state: AppState, days: number, now = new Date()) {
  const today = startOfDay(now);
  return Array.from({ length: days }).map((_, i) => {
    const date = addDays(today, -(days - 1 - i));
    const key = dayKey(date);
    return {
      key,
      label: format(date, "d MMM"),
      admissions: state.patients.filter((p) => dayKey(p.admissionDate) === key).length,
      discharges: state.patients.filter((p) => p.dischargeDate && dayKey(p.dischargeDate) === key).length,
      deaths: state.patients.filter((p) => p.deathDate && dayKey(p.deathDate) === key).length,
    };
  });
}

/** Daily temperature statistics across all readings. */
export function dailyTemperature(state: AppState, days: number, now = new Date()) {
  const today = startOfDay(now);
  const t = state.settings.feverThreshold;
  return Array.from({ length: days }).map((_, i) => {
    const date = addDays(today, -(days - 1 - i));
    const key = dayKey(date);
    const rs = state.readings.filter((r) => dayKey(r.recordedAt) === key);
    const avg = rs.length ? rs.reduce((s, r) => s + r.temperature, 0) / rs.length : null;
    return {
      key,
      label: format(date, "d MMM"),
      average: avg == null ? null : Math.round(avg * 100) / 100,
      max: rs.length ? Math.max(...rs.map((r) => r.temperature)) : null,
      fever: rs.filter((r) => r.temperature >= t).length,
      feverFree: rs.filter((r) => r.temperature < t).length,
      readings: rs.length,
    };
  });
}

/** Active patients on each past day, split by whether that day was febrile. */
export function activeCensus(state: AppState, days: number, now = new Date()) {
  const today = startOfDay(now);
  return Array.from({ length: days }).map((_, i) => {
    const date = addDays(today, -(days - 1 - i));
    const key = dayKey(date);
    const end = addDays(date, 1);
    const census = state.patients.filter((p) => {
      const adm = new Date(p.admissionDate);
      const out = p.dischargeDate ?? p.deathDate;
      return adm < end && (!out || new Date(out) >= date);
    }).length;
    return { key, label: format(date, "d MMM"), census };
  });
}
