import type { Role } from "./types";

export type Permission =
  | "patient:view_all"
  | "patient:view_assigned"
  | "patient:register"
  | "patient:flag"
  | "temperature:record"
  | "temperature:correct"
  | "visit:record"
  | "visit:override"
  | "clinical:decide"
  | "discharge:confirm"
  | "bed:view"
  | "bed:manage"
  | "analytics:view"
  | "audit:view"
  | "staff:manage"
  | "settings:manage";

const MATRIX: Record<Role, Permission[]> = {
  nurse: [
    "patient:view_assigned",
    "patient:flag",
    "temperature:record",
    "temperature:correct",
  ],
  doctor: [
    "patient:view_all",
    "visit:record",
    "visit:override",
    "clinical:decide",
    "temperature:correct",
  ],
  admin: [
    "patient:view_all",
    "patient:register",
    "discharge:confirm",
    "bed:view",
    "bed:manage",
    "analytics:view",
    "audit:view",
    "staff:manage",
    "settings:manage",
  ],
  head_doctor: [
    "patient:view_all",
    "bed:view",
    "analytics:view",
    "audit:view",
    "settings:manage",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function permissionsFor(role: Role): Permission[] {
  return [...MATRIX[role]];
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}

export function assertCan(role: Role, permission: Permission, action: string) {
  if (!can(role, permission)) {
    throw new PermissionError(`Your role is not authorised to ${action}.`);
  }
}
