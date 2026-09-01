"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type DailyHoursPoint = {
  date: string;
  totalHours: number;
  metTarget?: boolean;
  compliancePct?: number;
  label?: string;
};

type HoursTrendChartProps = {
  data: DailyHoursPoint[];
  targetHours: number;
  title: string;
  onBarClick?: (date: string) => void;
  selectedDate?: string | null;
  height?: number;
};

function HoursTooltip({
  active,
  payload,
  label,
  targetHours,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: DailyHoursPoint }>;
  label?: string;
  targetHours: number;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const hours = payload[0]?.value ?? 0;
  const met = point?.metTarget ?? hours >= targetHours;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm shadow-xl">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-[var(--pwc-orange)]">{hours.toFixed(1)} hours</p>
      <p className="text-muted">Target: {targetHours}h</p>
      <p className={met ? "text-green-400" : "text-amber-300"}>
        {met ? "Target met" : "Below target"}
      </p>
      {point?.compliancePct !== undefined && (
        <p className="text-muted">Compliance: {point.compliancePct}%</p>
      )}
      <p className="mt-1 text-xs text-muted">Click bar to filter table</p>
    </div>
  );
}

export function HoursTrendChart({
  data,
  targetHours,
  title,
  onBarClick,
  selectedDate,
  height = 280,
}: HoursTrendChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    shortDate: d.date.slice(5),
    label: d.label ?? d.date,
  }));

  return (
    <div>
      <p className="mb-3 text-sm font-medium">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="shortDate"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
            domain={[0, "auto"]}
          />
          <Tooltip content={<HoursTooltip targetHours={targetHours} />} />
          <ReferenceLine
            y={targetHours}
            stroke="var(--muted)"
            strokeDasharray="4 4"
            label={{ value: `${targetHours}h`, fill: "var(--muted)", fontSize: 10 }}
          />
          <Bar
            dataKey="totalHours"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            cursor={onBarClick ? "pointer" : "default"}
            onClick={(entry) => onBarClick?.(entry.date as string)}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.date}
                fill={
                  selectedDate === entry.date
                    ? "#ffffff"
                    : entry.metTarget === false
                      ? "#c2410c"
                      : "var(--pwc-orange)"
                }
                opacity={selectedDate && selectedDate !== entry.date ? 0.45 : 1}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

type ComplianceTrendChartProps = {
  data: DailyHoursPoint[];
  title: string;
  height?: number;
};

export function ComplianceTrendChart({ data, title, height = 240 }: ComplianceTrendChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    shortDate: d.date.slice(5),
    compliancePct: d.compliancePct ?? 0,
  }));

  return (
    <div>
      <p className="mb-3 text-sm font-medium">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="shortDate"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm shadow-xl">
                  <p className="font-medium">{label}</p>
                  <p className="text-[var(--pwc-orange)]">{payload[0]?.value}% met target</p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="compliancePct"
            stroke="#2ecc71"
            strokeWidth={2}
            dot={{ fill: "#2ecc71", r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

type StatusBreakdown = {
  inOffice: number;
  notInOffice: number;
  noAgent: number;
};

export function StatusDonutChart({
  breakdown,
  title,
}: {
  breakdown: StatusBreakdown;
  title: string;
}) {
  const segments = [
    { name: "In office", value: breakdown.inOffice, color: "#2ecc71" },
    { name: "Not in office", value: breakdown.notInOffice, color: "#3b82f6" },
    { name: "No agent", value: breakdown.noAgent, color: "#6b7280" },
  ].filter((s) => s.value > 0);

  if (segments.length === 0) {
    return (
      <div>
        <p className="mb-3 text-sm font-medium">{title}</p>
        <p className="text-sm text-muted">No users to display.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm font-medium">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={segments}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 80, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={76}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as { name: string; value: number };
              return (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm shadow-xl">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-[var(--pwc-orange)]">{row.value} users</p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {segments.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
