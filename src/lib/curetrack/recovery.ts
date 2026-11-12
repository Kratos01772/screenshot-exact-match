import { addDays, format, parseISO, startOfDay, differenceInCalendarDays } from "date-fns";
import type { TemperatureReading } from "./types";

export type DayStatus = "fever_free" | "fever" | "missing";

export interface RecoveryDay {
  date: string; // yyyy-MM-dd
  status: DayStatus;
  maxTemp: number | null;
}

export interface RecoveryResult {
  /** Consecutive completed (past) calendar days that were fever-free, ending yesterday. */
  completedDays: number;
  required: number;
  eligible: boolean;
  /** True when today already has a fever reading, which resets the streak. */
  feverToday: boolean;
  todayStatus: DayStatus | "pending";
  /** Day the patient will meet criteria if every remaining day stays fever-free. */
  projectedEligibleDate: string | null;
  /** The last `required` completed days, oldest first, for the progress indicator. */
  window: RecoveryDay[];
  /** Reason the streak stopped (for explanations). */
  streakBreak: RecoveryDay | null;
}

export const dayKey = (d: Date | string) =>
  format(typeof d === "string" ? parseISO(d) : d, "yyyy-MM-dd");

/** Classify each calendar day by its valid readings (effective, corrected values). */
export function classifyDays(
  readings: TemperatureReading[],
  threshold: number,
): Map<string, RecoveryDay> {
  const map = new Map<string, RecoveryDay>();
  for (const r of readings) {
    const key = dayKey(r.recordedAt);
    const existing = map.get(key);
    const maxTemp = Math.max(existing?.maxTemp ?? -Infinity, r.temperature);
    map.set(key, {
      date: key,
      maxTemp,
      status: maxTemp >= threshold ? "fever" : "fever_free",
    });
  }
  return map;
}

/**
 * Recovery rule: a patient needs `required` consecutive completed calendar days, each with
 * at least one valid reading and no reading at/above the fever threshold.
 * - Missing days never count as fever-free.
 * - A fever reading (including one recorded today) resets the streak.
 * - Today is incomplete and is never counted as a completed day.
 */
export function computeRecovery(
  readings: TemperatureReading[],
  admissionDate: string,
  threshold: number,
  required: number,
  now: Date = new Date(),
): RecoveryResult {
  const days = classifyDays(readings, threshold);
  const today = startOfDay(now);
  const admission = startOfDay(parseISO(admissionDate));
  const todayKey = dayKey(today);
  const todayEntry = days.get(todayKey);
  const feverToday = todayEntry?.status === "fever";

  let completed = 0;
  let streakBreak: RecoveryDay | null = null;
  const totalPast = differenceInCalendarDays(today, admission);
  for (let i = 1; i <= totalPast; i++) {
    const key = dayKey(addDays(today, -i));
    const d = days.get(key) ?? { date: key, status: "missing" as const, maxTemp: null };
    if (d.status !== "fever_free") {
      streakBreak = d;
      break;
    }
    completed++;
  }
  if (feverToday) {
    streakBreak = todayEntry!;
    completed = 0;
  }

  const window: RecoveryDay[] = [];
  for (let i = required; i >= 1; i--) {
    const date = addDays(today, -i);
    const key = dayKey(date);
    if (date < admission) continue;
    window.push(days.get(key) ?? { date: key, status: "missing", maxTemp: null });
  }

  const eligible = completed >= required;
  let projectedEligibleDate: string | null = null;
  if (!eligible) {
    const offset = feverToday ? required + 1 : required - completed;
    projectedEligibleDate = dayKey(addDays(today, offset));
  }

  return {
    completedDays: completed,
    required,
    eligible,
    feverToday,
    todayStatus: todayEntry?.status ?? "pending",
    projectedEligibleDate,
    window,
    streakBreak,
  };
}
