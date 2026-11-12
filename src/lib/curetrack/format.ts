import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

const d = (v: string | Date) => (typeof v === "string" ? parseISO(v) : v);
export const fmtDate = (v: string | Date) => format(d(v), "d MMM yyyy");
export const fmtShortDate = (v: string | Date) => format(d(v), "d MMM");
export const fmtTime = (v: string | Date) => format(d(v), "HH:mm");
export const fmtDateTime = (v: string | Date) => format(d(v), "d MMM yyyy, HH:mm");
export const fmtRelative = (v: string | Date) => `${formatDistanceToNowStrict(d(v))} ago`;
export const fmtTemp = (t: number | null | undefined) => (t == null ? "—" : `${t.toFixed(1)}°C`);
export const fmtPct = (v: number | null, digits = 1) => (v == null ? "—" : `${v.toFixed(digits)}%`);
