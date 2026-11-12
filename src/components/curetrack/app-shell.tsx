import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, Menu, RotateCcw, LogOut, UserCog, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Logo } from "./logo";
import { NAV_GROUPS, type NavItem } from "./nav";
import { NotificationList } from "./notification-list";
import { can } from "@/lib/curetrack/permissions";
import { notificationsFor } from "@/lib/curetrack/selectors";
import { resetDemo, signIn, signOut, useAppState, useCurrentUser, useNow } from "@/lib/curetrack/store";
import { ROLE_LABELS, type Staff } from "@/lib/curetrack/types";

function allowed(item: NavItem, user: Staff) {
  if (item.permission && !can(user.role, item.permission)) return false;
  if (item.roles && !item.roles.includes(user.role)) return false;
  return true;
}

function initials(name: string) {
  return name
    .replace(/^Dr\.\s*/, "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((g) => {
        const items = g.items.filter((i) => allowed(i, user));
        if (!items.length) return null;
        return (
          <div key={g.label}>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {g.label}
            </div>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  item.to === "/patients"
                    ? pathname === "/patients" || (pathname.startsWith("/patients/") && pathname !== "/patients/new")
                    : pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className={cn("size-4", active ? "text-sidebar-primary" : "text-sidebar-muted")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  const state = useAppState();
  const occupied = state.beds.filter((b) => b.status === "occupied").length;
  const pct = (occupied / state.settings.capacity) * 100;
  return (
    <div className="border-t border-sidebar-border p-4">
      <div className="flex items-center justify-between text-xs text-sidebar-muted">
        <span>Bed occupancy</span>
        <span className="tabular text-sidebar-foreground">
          {occupied}/{state.settings.capacity}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sidebar-accent">
        <div className="h-full rounded-full bg-sidebar-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <Logo inverted />
      </div>
      <SidebarNav onNavigate={onNavigate} />
      <SidebarFooter />
    </div>
  );
}

function NotificationBell() {
  const state = useAppState();
  const user = useCurrentUser();
  const now = useNow();
  const items = notificationsFor(state, user, now);
  const urgent = items.filter((i) => i.severity === "critical" || i.severity === "warning").length;
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${items.length})`}>
          <Bell className="size-[18px]" />
          {items.length > 0 && (
            <span
              className={cn(
                "absolute right-1 top-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold leading-4",
                urgent ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
              )}
            >
              {items.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold">Notifications</div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          <NotificationList items={items.slice(0, 8)} compact onNavigate={() => setOpen(false)} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const user = useCurrentUser();
  const state = useAppState();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);
  const demo = state.staff.filter((s) => s.demoAccount);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-md px-1.5 py-1 text-left hover:bg-muted">
            <div className="grid size-8 place-items-center rounded-full bg-sidebar text-xs font-semibold text-sidebar-accent-foreground">
              {initials(user.name)}
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-[13px] font-semibold text-foreground">{user.name}</div>
              <div className="text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</div>
            </div>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <UserCog className="size-3.5" /> Switch demo role
          </DropdownMenuLabel>
          {demo.map((s) => (
            <DropdownMenuItem
              key={s.id}
              disabled={s.id === user.id}
              onSelect={() => {
                signIn(s.id);
                toast.success(`Signed in as ${s.name}`, { description: ROLE_LABELS[s.role] });
                navigate({ to: "/dashboard" });
              }}
            >
              <div className="flex w-full items-center justify-between">
                <span>{s.name}</span>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[s.role]}</span>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
            <RotateCcw className="size-4" /> Reset demo data
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              All patients, readings, visits, discharges, bed changes and audit entries made in this browser will be
              replaced with the original demo scenario. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetDemo(user);
                toast.success("Demo data reset");
                navigate({ to: "/dashboard" });
              }}
            >
              Reset data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const now = useNow();
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <Sidebar />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning-strong">
            <FlaskConical className="size-3.5" />
            Demo environment
          </div>
          <div className="ml-auto hidden text-right text-xs leading-tight text-muted-foreground md:block">
            <div className="font-medium text-foreground">{format(now, "EEEE, d MMMM yyyy")}</div>
            <div className="tabular">{format(now, "HH:mm")} local time</div>
          </div>
          <div className="ml-auto flex items-center gap-1 md:ml-4">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
