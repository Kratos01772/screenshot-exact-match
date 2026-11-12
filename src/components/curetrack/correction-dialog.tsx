import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { correctTemperature } from "@/lib/curetrack/actions";
import { fmtDateTime } from "@/lib/curetrack/format";
import { perform } from "@/lib/curetrack/store";
import type { TemperatureReading } from "@/lib/curetrack/types";
import { FieldError } from "./bits";

export function CorrectionDialog({ reading, onClose }: { reading: TemperatureReading | null; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setValue("");
    setReason("");
    setError(null);
    onClose();
  };
  return (
    <Dialog open={!!reading} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct temperature reading</DialogTitle>
          <DialogDescription>
            The original value is preserved. Your name, the time and the reason are added to the reading and the audit log.
          </DialogDescription>
        </DialogHeader>
        {reading && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const res = perform(
                (s, a) => correctTemperature(s, a, { readingId: reading.id, newValue: Number(value), reason }),
                "Correction saved",
              );
              if (res.ok) close();
              else setError(res.error);
            }}
          >
            <div className="rounded-md bg-muted p-3 text-sm">
              <div>Recorded {fmtDateTime(reading.recordedAt)}</div>
              <div>
                Current value <span className="font-mono font-semibold">{reading.temperature.toFixed(1)}°C</span>
                {reading.corrections.length > 0 && (
                  <span className="text-muted-foreground"> · original {reading.originalTemperature.toFixed(1)}°C</span>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="corr-value">Corrected value (°C)</Label>
              <Input id="corr-value" type="number" step="0.1" className="mt-1.5" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="corr-reason">Reason for correction</Label>
              <Textarea id="corr-reason" className="mt-1.5" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Transcription error — thermometer showed 36.8°C" />
            </div>
            <FieldError>{error}</FieldError>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit">Save correction</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
