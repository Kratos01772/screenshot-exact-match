import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const tooltipStyle = { borderRadius: 8, borderColor: "var(--color-border)", fontSize: 12 };

export function FlowChart({
  data,
  height = 240,
  showDeaths = false,
}: {
  data: { label: string; admissions: number; discharges: number; deaths: number }[];
  height?: number;
  showDeaths?: boolean;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={2}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          <Bar dataKey="admissions" name="Admissions" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="discharges" name="Discharges" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} maxBarSize={18} />
          {showDeaths && <Bar dataKey="deaths" name="Deaths" fill="var(--color-chart-5)" radius={[3, 3, 0, 0]} maxBarSize={18} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TemperatureTrendChart({
  data,
  threshold,
  height = 260,
}: {
  data: { label: string; average: number | null; max: number | null }[];
  threshold: number;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} interval="preserveStartEnd" />
          <YAxis domain={[35.5, 41]} tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}°`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => (v == null ? "—" : `${Number(v).toFixed(2)}°C`)} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          <ReferenceLine y={threshold} stroke="var(--color-destructive)" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="average" name="Average" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="max" name="Highest" stroke="var(--color-chart-3)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RecoveryTrendChart({
  data,
  height = 260,
}: {
  data: { label: string; fever: number; feverFree: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          <Bar dataKey="feverFree" name="Fever-free readings" stackId="a" fill="var(--color-chart-2)" maxBarSize={22} />
          <Bar dataKey="fever" name="Fever readings" stackId="a" fill="var(--color-chart-3)" radius={[3, 3, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OccupancyBar({
  occupied,
  held,
  capacity,
}: {
  occupied: number;
  held: number;
  capacity: number;
}) {
  const available = capacity - occupied - held;
  const pct = (n: number) => `${(n / capacity) * 100}%`;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-success-soft">
        <div className="h-full bg-destructive" style={{ width: pct(occupied) }} title={`Occupied: ${occupied}`} />
        <div className="h-full bg-warning" style={{ width: pct(held) }} title={`Reserved/unavailable: ${held}`} />
        <div className="h-full bg-success" style={{ width: pct(available) }} title={`Available: ${available}`} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive" />Occupied {occupied}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" />Reserved / unavailable {held}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" />Available {available}</span>
      </div>
    </div>
  );
}
