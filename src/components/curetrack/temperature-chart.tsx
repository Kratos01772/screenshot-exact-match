import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import type { TemperatureReading } from "@/lib/curetrack/types";

export function TemperatureChart({
  readings,
  threshold,
  height = 240,
}: {
  readings: TemperatureReading[];
  threshold: number;
  height?: number;
}) {
  const data = readings.map((r) => ({
    t: parseISO(r.recordedAt).getTime(),
    temp: r.temperature,
  }));
  const temps = data.map((d) => d.temp);
  const min = Math.floor(Math.min(36, ...temps) - 0.3);
  const max = Math.ceil(Math.max(39, ...temps) + 0.3);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => format(v, "d MMM")}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}°`}
          />
          <Tooltip
            labelFormatter={(v) => format(v as number, "d MMM yyyy, HH:mm")}
            formatter={(v) => [`${Number(v).toFixed(1)}°C`, "Temperature"]}
            contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", fontSize: 12 }}
          />
          <ReferenceLine
            y={threshold}
            stroke="var(--color-destructive)"
            strokeDasharray="4 4"
            label={{ value: `Fever ${threshold.toFixed(1)}°C`, position: "insideTopRight", fontSize: 11, fill: "var(--color-critical-strong)" }}
          />
          <Line
            type="monotone"
            dataKey="temp"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={(p: { cx?: number; cy?: number; payload?: { temp: number }; index?: number }) => (
              <circle
                key={p.index}
                cx={p.cx}
                cy={p.cy}
                r={3.5}
                fill={p.payload && p.payload.temp >= threshold ? "var(--color-destructive)" : "var(--color-primary)"}
                stroke="var(--color-card)"
                strokeWidth={1.5}
              />
            )}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
