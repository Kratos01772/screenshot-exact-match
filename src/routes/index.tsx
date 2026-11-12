import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BedDouble, ClipboardCheck, FlaskConical, ShieldCheck, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/curetrack/logo";
import { ROLE_SUMMARY } from "@/components/curetrack/nav";
import { cn } from "@/lib/utils";
import { DEMO_STAFF } from "@/lib/curetrack/seed";
import { signIn } from "@/lib/curetrack/store";
import { ROLE_LABELS } from "@/lib/curetrack/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — CureTrack" },
      {
        name: "description",
        content: "Enter the CureTrack demo environment as a nurse, doctor, administrator or head doctor.",
      },
      { property: "og:title", content: "CureTrack — Smarter Quarantine. Safer Recovery." },
      {
        property: "og:description",
        content: "Quarantine patient monitoring, recovery tracking, discharge and bed management for hospitals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

const DEMO_ACCOUNTS = DEMO_STAFF.filter((s) => s.demoAccount);

const HIGHLIGHTS = [
  { icon: Thermometer, title: "Daily temperature rounds", text: "One routine reading per patient per day, with audited corrections." },
  { icon: ClipboardCheck, title: "Three-day recovery rule", text: "Automatic eligibility tracking. Discharge always needs human sign-off." },
  { icon: BedDouble, title: "Live bed availability", text: "74-bed facility view that updates the moment a discharge is confirmed." },
  { icon: ShieldCheck, title: "Role-based access & audit", text: "Every sensitive action is permission-checked and logged." },
];

function LoginPage() {
  const [selected, setSelected] = useState(DEMO_ACCOUNTS[0].id);
  const navigate = useNavigate();
  const enter = () => {
    signIn(selected);
    navigate({ to: "/dashboard" });
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 lg:flex lg:flex-col">
        <Logo inverted />
        <div className="my-auto max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sidebar-primary">
            Quarantine operations platform
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-sidebar-accent-foreground">
            Smarter Quarantine.
            <br />
            Safer Recovery.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-sidebar-foreground/80">
            Replace paper charts with one shared record for temperatures, doctor rounds, recovery eligibility and
            beds.
          </p>
          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-3.5">
                <div className="grid size-9 shrink-0 place-items-center rounded-md bg-sidebar-accent text-sidebar-primary">
                  <h.icon className="size-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-sidebar-accent-foreground">{h.title}</div>
                  <div className="text-[13px] text-sidebar-muted">{h.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-sidebar-muted">© {new Date().getFullYear()} CureTrack · Prototype for assessment</div>
      </aside>

      <main className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-[460px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <div>
              <div className="font-semibold">CureTrack</div>
              <div className="text-xs text-muted-foreground">Smarter Quarantine. Safer Recovery.</div>
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a staff role to explore its workspace.</p>

          <div className="mt-5 flex gap-3 rounded-lg border border-warning/50 bg-warning-soft p-3.5 text-[13px] text-warning-strong">
            <FlaskConical className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-semibold">Demo environment</div>
              <div className="opacity-90">
                All patients are fictional sample data, saved only in this browser. No credentials needed — you can
                switch roles and reset the data at any time.
              </div>
            </div>
          </div>

          <fieldset className="mt-6">
            <legend className="mb-2 text-[13px] font-medium text-foreground">Demo account</legend>
            <div role="radiogroup" className="space-y-2">
              {DEMO_ACCOUNTS.map((s) => {
                const Icon = ROLE_SUMMARY[s.role].icon;
                const active = selected === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelected(s.id)}
                    onDoubleClick={() => {
                      setSelected(s.id);
                      signIn(s.id);
                      navigate({ to: "/dashboard" });
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border bg-card p-3.5 text-left transition-colors",
                      active ? "border-primary ring-1 ring-primary" : "hover:border-input hover:bg-muted/40",
                    )}
                  >
                    <div
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-md",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{s.name}</span>
                        <span className="text-xs font-medium text-muted-foreground">{ROLE_LABELS[s.role]}</span>
                      </div>
                      <div className="mt-0.5 text-[13px] text-muted-foreground">{ROLE_SUMMARY[s.role].blurb}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button size="lg" className="mt-6 w-full" onClick={enter}>
            Enter Demo Environment <ArrowRight />
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Production deployments would use hospital single sign-on. Demo mode bypasses authentication by design.
          </p>
        </div>
      </main>
    </div>
  );
}
