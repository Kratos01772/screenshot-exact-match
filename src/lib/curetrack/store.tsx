import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { PermissionError, RuleError } from "./permissions";
import { audit } from "./actions";
import { createSeedState, STATE_VERSION } from "./seed";
import type { AppState, Staff } from "./types";

const STATE_KEY = "curetrack.state";
const SESSION_KEY = "curetrack.session";

let state: AppState | null = null;
let session: string | null | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function hasStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function load(): AppState {
  if (hasStorage()) {
    try {
      const raw = window.localStorage.getItem(STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        if (parsed.version === STATE_VERSION) return parsed;
      }
    } catch {
      /* fall through to a fresh seed */
    }
  }
  const seeded = createSeedState();
  persist(seeded);
  return seeded;
}

function persist(s: AppState) {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    toast.error("Could not save to this browser's storage. Changes will be lost on refresh.");
  }
}

export function getState(): AppState {
  if (!state) state = load();
  return state;
}

export function setState(next: AppState) {
  state = next;
  persist(next);
  emit();
}

export function getSessionId(): string | null {
  if (session === undefined) session = hasStorage() ? window.localStorage.getItem(SESSION_KEY) : null;
  return session;
}

export function getSessionUser(): Staff | null {
  const id = getSessionId();
  if (!id) return null;
  const user = getState().staff.find((s) => s.id === id && s.active);
  return user ?? null;
}

export function signIn(staffId: string) {
  getState();
  session = staffId;
  if (hasStorage()) window.localStorage.setItem(SESSION_KEY, staffId);
  emit();
}

export function signOut() {
  session = null;
  if (hasStorage()) window.localStorage.removeItem(SESSION_KEY);
  emit();
}

export function resetDemo(actor: Staff | null) {
  let fresh = createSeedState();
  if (actor) fresh = audit(fresh, actor, "demo_reset", "Demo data reset to the initial scenario");
  setState(fresh);
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STATE_KEY) state = null;
    if (e.key === SESSION_KEY) session = undefined;
    if (e.key === STATE_KEY || e.key === SESSION_KEY) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useSessionUser(): Staff | null {
  const s = useAppState();
  const id = useSyncExternalStore(subscribe, getSessionId, () => null);
  return id ? (s.staff.find((x) => x.id === id && x.active) ?? null) : null;
}

/** Signed-in user; only call inside the authenticated console. */
export function useCurrentUser(): Staff {
  const u = useSessionUser();
  if (!u) throw new Error("No active demo session");
  return u;
}

/** Re-render periodically so "today", clocks and streaks stay current. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Runs a rule-checked action against the latest state as the signed-in user.
 * Rule and permission failures surface as messages and leave state untouched.
 */
export function perform<R extends { state: AppState }>(
  fn: (s: AppState, actor: Staff) => R,
  success?: string | ((r: R) => string),
): { ok: true; result: R } | { ok: false; error: string } {
  const actor = getSessionUser();
  if (!actor) {
    toast.error("Your session has ended. Sign in again.");
    return { ok: false, error: "No session" };
  }
  try {
    const result = fn(getState(), actor);
    setState(result.state);
    if (success) toast.success(typeof success === "string" ? success : success(result));
    return { ok: true, result };
  } catch (e) {
    const message =
      e instanceof RuleError || e instanceof PermissionError
        ? e.message
        : "Something went wrong. Nothing was saved.";
    if (!(e instanceof RuleError || e instanceof PermissionError)) console.error(e);
    toast.error(e instanceof PermissionError ? "Not authorised" : "Action blocked", { description: message });
    return { ok: false, error: message };
  }
}
