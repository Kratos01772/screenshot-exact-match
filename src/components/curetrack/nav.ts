import {
  Activity,
  BarChart3,
  Bell,
  BedDouble,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  LogOut as DischargeIcon,
  Settings,
  Stethoscope,
  Thermometer,
  UserPlus,
  Users,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { LinkProps } from "@tanstack/react-router";
import type { Permission } from "@/lib/curetrack/permissions";
import type { Role } from "@/lib/curetrack/types";

export interface NavItem {
  to: NonNullable<LinkProps["to"]>;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  roles?: Role[];
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Clinical",
    items: [
      { to: "/patients", label: "Patients", icon: Users },
      { to: "/temperature", label: "Record temperature", icon: Thermometer, permission: "temperature:record" },
      { to: "/visits", label: "Doctor visits", icon: Stethoscope, permission: "visit:record" },
      { to: "/recovery", label: "Recovery tracking", icon: HeartPulse },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/patients/new", label: "Register patient", icon: UserPlus, permission: "patient:register" },
      { to: "/discharge", label: "Discharge", icon: DischargeIcon, roles: ["admin", "doctor", "head_doctor"] },
      { to: "/beds", label: "Bed management", icon: BedDouble, permission: "bed:view" },
      { to: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics:view" },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/audit", label: "Audit log", icon: ClipboardList, permission: "audit:view" },
      { to: "/staff", label: "Staff & roles", icon: ShieldCheck, permission: "staff:manage" },
      { to: "/settings", label: "Hospital settings", icon: Settings },
    ],
  },
  {
    label: "Product",
    items: [{ to: "/prioritisation", label: "Sprint prioritisation", icon: ListChecks }],
  },
];

export const ROLE_SUMMARY: Record<Role, { icon: LucideIcon; blurb: string }> = {
  nurse: { icon: Thermometer, blurb: "Record daily temperatures, monitor assigned patients, flag concerns." },
  doctor: { icon: Stethoscope, blurb: "Review temperatures, record visits, confirm medical recovery." },
  admin: { icon: ClipboardList, blurb: "Register patients, allocate beds, confirm discharges, manage staff." },
  head_doctor: { icon: Activity, blurb: "Hospital-wide oversight, outcomes, audit logs and exceptions." },
};
