import { createFileRoute, Navigate, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/curetrack/app-shell";
import { getSessionUser, useSessionUser } from "@/lib/curetrack/store";

// Demo data and session live in this browser's storage, so the console renders client-side only.
export const Route = createFileRoute("/_console")({
  ssr: false,
  beforeLoad: () => {
    if (!getSessionUser()) throw redirect({ to: "/" });
  },
  component: ConsoleLayout,
});

function ConsoleLayout() {
  const user = useSessionUser();
  if (!user) return <Navigate to="/" />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
