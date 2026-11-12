import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BedDouble, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccessDenied, FieldError, PageHeader, Panel } from "@/components/curetrack/bits";
import { can } from "@/lib/curetrack/permissions";
import { registerPatient, validateRegistration, type FieldErrors, type RegistrationInput } from "@/lib/curetrack/actions";
import { bedSummary } from "@/lib/curetrack/analytics";
import { perform, useAppState, useCurrentUser } from "@/lib/curetrack/store";

export const Route = createFileRoute("/_console/patients/new")({
  head: () => ({
    meta: [
      { title: "Register patient — CureTrack" },
      { name: "description", content: "Admit a new quarantine patient and allocate an available bed." },
      { property: "og:title", content: "Register patient — CureTrack" },
      { property: "og:description", content: "Patient admission with validated bed allocation." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const user = useCurrentUser();
  if (!can(user.role, "patient:register")) return <AccessDenied what="register patients" />;
  return <RegisterForm />;
}

function RegisterForm() {
  const state = useAppState();
  const navigate = useNavigate();
  const nurses = state.staff.filter((s) => s.role === "nurse" && s.active);
  const [form, setForm] = useState<Omit<RegistrationInput, "age"> & { age: string }>({
    name: "",
    age: "",
    gender: "",
    contact: "",
    emergencyContact: "",
    admissionDate: format(new Date(), "yyyy-MM-dd"),
    symptoms: "",
    medicalHistory: "",
    bedId: "",
    assignedNurseId: nurses[0]?.id ?? null,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const beds = bedSummary(state);
  const available = state.beds.filter((b) => b.status === "available");
  const wards = Array.from(new Set(available.map((b) => b.ward)));
  const full = beds.occupied >= beds.capacity || available.length === 0;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: RegistrationInput = { ...form, age: form.age === "" ? NaN : Number(form.age) };
    const errs = validateRegistration(state, input);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const res = perform((s, actor) => registerPatient(s, actor, input), (r) => `${r.patient.name} registered — bed ${r.patient.lastBedNumber} allocated`);
    if (res.ok) navigate({ to: "/patients/$patientId", params: { patientId: res.result.patient.id } });
  };

  return (
    <>
      <PageHeader title="Register patient" description="All fields except medical history are required. Only available beds can be selected." />
      <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Patient details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" className="mt-1.5" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} />
                <FieldError>{errors.name}</FieldError>
              </div>
              <div>
                <Label htmlFor="age">Age</Label>
                <Input id="age" type="number" min={0} max={120} className="mt-1.5" value={form.age} onChange={(e) => set("age", e.target.value)} aria-invalid={!!errors.age} />
                <FieldError>{errors.age}</FieldError>
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => set("gender", v as RegistrationInput["gender"])}>
                  <SelectTrigger className="mt-1.5" aria-label="Gender" aria-invalid={!!errors.gender}><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="other">Other / prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError>{errors.gender}</FieldError>
              </div>
              <div>
                <Label htmlFor="contact">Contact number</Label>
                <Input id="contact" type="tel" className="mt-1.5" value={form.contact} onChange={(e) => set("contact", e.target.value)} placeholder="+44 7700 900123" aria-invalid={!!errors.contact} />
                <FieldError>{errors.contact}</FieldError>
              </div>
              <div>
                <Label htmlFor="emergency">Emergency contact</Label>
                <Input id="emergency" className="mt-1.5" value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} placeholder="Name · phone" aria-invalid={!!errors.emergencyContact} />
                <FieldError>{errors.emergencyContact}</FieldError>
              </div>
            </div>
          </Panel>
          <Panel title="Clinical information">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="admission">Admission date</Label>
                <Input id="admission" type="date" max={format(new Date(), "yyyy-MM-dd")} className="mt-1.5" value={form.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} aria-invalid={!!errors.admissionDate} />
                <FieldError>{errors.admissionDate}</FieldError>
              </div>
              <div>
                <Label>Assigned nurse</Label>
                <Select value={form.assignedNurseId ?? ""} onValueChange={(v) => set("assignedNurseId", v)}>
                  <SelectTrigger className="mt-1.5" aria-label="Assigned nurse"><SelectValue placeholder="Select nurse" /></SelectTrigger>
                  <SelectContent>
                    {nurses.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="symptoms">Symptoms</Label>
                <Textarea id="symptoms" className="mt-1.5" rows={3} value={form.symptoms} onChange={(e) => set("symptoms", e.target.value)} placeholder="e.g. Fever 38.6°C, dry cough, fatigue" aria-invalid={!!errors.symptoms} />
                <FieldError>{errors.symptoms}</FieldError>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="history">Medical history <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea id="history" className="mt-1.5" rows={3} value={form.medicalHistory} onChange={(e) => set("medicalHistory", e.target.value)} placeholder="Chronic conditions, medications, allergies" />
              </div>
            </div>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Bed allocation" description={`${available.length} available of ${beds.capacity}`}>
            {full ? (
              <div className="rounded-md border border-destructive/40 bg-critical-soft p-3 text-sm text-critical-strong">
                No beds are available. The facility cannot exceed {beds.capacity} occupied beds.
              </div>
            ) : (
              <>
                <Label>Assigned bed</Label>
                <Select value={form.bedId} onValueChange={(v) => set("bedId", v)}>
                  <SelectTrigger className="mt-1.5" aria-label="Assigned bed" aria-invalid={!!errors.bedId}><SelectValue placeholder="Select an available bed" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {wards.map((w) => (
                      <SelectGroup key={w}>
                        <SelectLabel>{w}</SelectLabel>
                        {available.filter((b) => b.ward === w).map((b) => (
                          <SelectItem key={b.id} value={b.id}>Bed {b.bedNumber}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{errors.bedId}</FieldError>
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <BedDouble className="mt-0.5 size-3.5 shrink-0" /> Occupied, reserved and unavailable beds are excluded. The bed is checked again when you submit.
                </p>
              </>
            )}
          </Panel>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={full}><UserPlus /> Register patient</Button>
            <Button asChild variant="outline"><Link to="/patients">Cancel</Link></Button>
          </div>
        </div>
      </form>
    </>
  );
}
