"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  analogHandAngles,
  clockPartsInTimezone,
  DESK_CLOCK_COLOR_CSS,
  DEFAULT_DESK_CLOCK_SETTINGS,
  readDeskClockSettings,
  writeDeskClockSettings,
  type DeskClockColor,
  type DeskClockSettings,
} from "@/lib/desk-clock";
import type { MonthlyProgressDay } from "@/lib/monthly-progress";
import { DashboardRefreshButton } from "@/components/DashboardRefreshButton";
import { DeskClockCalendar } from "./DeskClockCalendar";
import { DashboardMiniStat, type StatusTone } from "@/components/dashboard/DashboardMiniStat";
import { formatTime } from "@/lib/visits";

const LAPTOP_TOOLTIP =
  "Total time today your laptop was on with the My Office Pulse agent running. Sleep and long gaps between pulses are excluded. This is not the span from first to last pulse.";

export type DeskClockTodayStats = {
  totalHours: number;
  targetHours: number;
  metTarget: boolean;
  inOfficeNow: boolean;
  agentStatusValue: string;
  agentStatusTone: StatusTone;
  firstCheckIn: Date | null;
  laptopActiveHours: number;
  firstAgentOnAt: Date | null;
  lastSyncedLabel: string;
  lastSyncedTone: StatusTone;
};

type DeskClockPanelProps = {
  timezone: string;
  dayKey: string;
  monthKey: string;
  monthDays: MonthlyProgressDay[];
  todayStats: DeskClockTodayStats;
};

function DeskClockTodayHeader({
  dayKey,
  settingsControl,
}: {
  dayKey: string;
  settingsControl?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-3">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Today</h1>
        <p className="text-xs text-muted sm:text-sm">{dayKey} · Your hours only</p>
      </div>
      <div className="flex items-center gap-2">
        <DashboardRefreshButton />
        {settingsControl}
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function DeskClockPanel({
  timezone,
  dayKey,
  monthKey,
  monthDays,
  todayStats,
}: DeskClockPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [settings, setSettings] = useState<DeskClockSettings>(DEFAULT_DESK_CLOCK_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSettings(readDeskClockSettings());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const region = settingsRegionRef.current;
      if (region && !region.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!mounted) return;
    const ms = settings.showSeconds ? 500 : 1000;
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, [mounted, settings.showSeconds]);

  const updateSettings = useCallback((patch: Partial<DeskClockSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      writeDeskClockSettings(next);
      return next;
    });
  }, []);

  if (!mounted) {
    return (
      <section className="card overflow-hidden p-0" aria-hidden>
        <div className="border-b border-[var(--border)]">
          <DeskClockTodayHeader dayKey={dayKey} />
        </div>
        <div className="p-4 sm:p-5">
          <div className="h-32 animate-pulse rounded-lg bg-[var(--border)]/30" />
        </div>
      </section>
    );
  }

  if (settings.hidden) {
    return (
      <div className="space-y-3">
        <DeskClockTodayHeader dayKey={dayKey} />
        <p className="text-sm">
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={() => updateSettings({ hidden: false })}
          >
            Show desk clock
          </button>
        </p>
      </div>
    );
  }

  const parts = clockPartsInTimezone(now, timezone, {
    hour12: settings.hour12,
    showSeconds: settings.showSeconds,
  });
  const accent = DESK_CLOCK_COLOR_CSS[settings.color];

  return (
    <section className="card overflow-hidden p-0">
      <div ref={settingsRegionRef} className="border-b border-[var(--border)]">
        <DeskClockTodayHeader
          dayKey={dayKey}
          settingsControl={
            <button
              type="button"
              className="btn-secondary inline-flex items-center justify-center p-1.5"
              aria-label="Desk clock settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <GearIcon />
            </button>
          }
        />
        {settingsOpen && (
          <DeskClockSettingsPanel
            settings={settings}
            onChange={updateSettings}
            onHide={() => {
              updateSettings({ hidden: true });
              setSettingsOpen(false);
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:gap-4">
        <div className="flex shrink-0 justify-center lg:justify-start">
          {settings.face === "led" ? (
            <LedFace parts={parts} accent={accent} showSeconds={settings.showSeconds} />
          ) : (
            <AnalogFace
              now={now}
              timezone={timezone}
              accent={accent}
              dateLabel={parts.dateLabel}
            />
          )}
        </div>
        <DeskClockTodayStatsGrid timezone={timezone} stats={todayStats} />
        {settings.showCalendar && (
          <div className="shrink-0 lg:ml-auto">
            <DeskClockCalendar monthKey={monthKey} todayKey={dayKey} monthDays={monthDays} />
          </div>
        )}
      </div>
    </section>
  );
}

function DeskClockTodayStatsGrid({
  timezone,
  stats,
}: {
  timezone: string;
  stats: DeskClockTodayStats;
}) {
  const remaining = Math.max(0, stats.targetHours - stats.totalHours);
  const officeHoursValue = `${stats.totalHours.toFixed(1)} / ${stats.targetHours}h`;
  const targetTone: StatusTone = stats.metTarget ? "success" : "warning";

  return (
    <div className="min-w-0 flex-1">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <DashboardMiniStat
          label="Office hours"
          value={officeHoursValue}
          tone={targetTone}
        />
        <DashboardMiniStat
          label="Target"
          value={stats.metTarget ? "Met" : `${remaining.toFixed(1)}h left`}
          tone={targetTone}
        />
        <DashboardMiniStat
          label="In office"
          value={stats.inOfficeNow ? "Yes" : "No"}
          tone={stats.inOfficeNow ? "success" : "neutral"}
        />
        <DashboardMiniStat label="Agent" value={stats.agentStatusValue} tone={stats.agentStatusTone} />
        <DashboardMiniStat
          label="First check-in"
          value={stats.firstCheckIn ? formatTime(stats.firstCheckIn, timezone) : "None"}
          tone={stats.firstCheckIn ? "success" : "muted"}
        />
        <DashboardMiniStat
          label="Agent uptime"
          value={`${stats.laptopActiveHours.toFixed(1)}h`}
          tooltip={
            stats.firstAgentOnAt
              ? `${LAPTOP_TOOLTIP} First switch-on today: ${formatTime(stats.firstAgentOnAt, timezone)}.`
              : LAPTOP_TOOLTIP
          }
        />
        <div className="col-span-2 sm:col-span-3">
          <DashboardMiniStat
            label="Last synced"
            value={stats.lastSyncedLabel}
            tone={stats.lastSyncedTone}
          />
        </div>
      </div>
    </div>
  );
}

function DeskClockSettingsPanel({
  settings,
  onChange,
  onHide,
}: {
  settings: DeskClockSettings;
  onChange: (patch: Partial<DeskClockSettings>) => void;
  onHide: () => void;
}) {
  return (
    <div
      className="mx-4 mb-3 rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] p-3 text-xs"
      role="region"
      aria-label="Desk clock customization"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SettingToggle
          label="LED"
          active={settings.face === "led"}
          onClick={() => onChange({ face: "led" })}
        />
        <SettingToggle
          label="Analog"
          active={settings.face === "analog"}
          onClick={() => onChange({ face: "analog" })}
        />
        <span className="mx-1 text-muted" aria-hidden>|</span>
        {(Object.keys(DESK_CLOCK_COLOR_CSS) as DeskClockColor[]).map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={`Color ${color}`}
            aria-pressed={settings.color === color}
            className={`h-5 w-5 rounded-full border-2 ${
              settings.color === color ? "border-[var(--foreground)]" : "border-transparent"
            }`}
            style={{ backgroundColor: DESK_CLOCK_COLOR_CSS[color] }}
            onClick={() => onChange({ color })}
          />
        ))}
        <span className="mx-1 text-muted" aria-hidden>|</span>
        <SettingToggle
          label="12h"
          active={settings.hour12}
          onClick={() => onChange({ hour12: true })}
        />
        <SettingToggle
          label="24h"
          active={!settings.hour12}
          onClick={() => onChange({ hour12: false })}
        />
        <SettingToggle
          label="Seconds"
          active={settings.showSeconds}
          onClick={() => onChange({ showSeconds: !settings.showSeconds })}
        />
        <SettingToggle
          label="Calendar"
          active={settings.showCalendar}
          onClick={() => onChange({ showCalendar: !settings.showCalendar })}
        />
      </div>
      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <button
          type="button"
          className="btn-secondary w-full rounded-md px-3 py-2 text-left text-sm font-medium text-muted hover:text-accent"
          onClick={onHide}
        >
          Hide desk clock
        </button>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rounded px-2 py-1 font-medium transition-colors ${
        active ? "bg-[var(--pwc-orange)] text-white" : "btn-secondary"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function LedFace({
  parts,
  accent,
  showSeconds,
}: {
  parts: ReturnType<typeof clockPartsInTimezone>;
  accent: string;
  showSeconds: boolean;
}) {
  const dayAbbrev = parts.weekdayShort.toUpperCase().slice(0, 2);

  return (
    <div
      className="deskclock-led w-full max-w-md rounded-lg px-4 py-5 sm:px-6"
      style={{ "--deskclock-accent": accent } as CSSProperties}
    >
      <div className="flex items-start gap-2">
        {parts.meridiem && (
          <span className="deskclock-led-text mt-1 text-xs font-semibold">{parts.meridiem}</span>
        )}
        <div className="flex flex-1 items-baseline justify-center gap-1 font-mono tabular-nums">
          <span className="deskclock-led-digit text-5xl font-bold tracking-wider sm:text-6xl">
            {parts.hours}
          </span>
          <span className="deskclock-led-digit text-5xl font-bold sm:text-6xl">:</span>
          <span className="deskclock-led-digit text-5xl font-bold tracking-wider sm:text-6xl">
            {parts.minutes}
          </span>
          {showSeconds && (
            <>
              <span className="deskclock-led-digit text-3xl font-bold sm:text-4xl">:</span>
              <span className="deskclock-led-digit text-3xl font-bold sm:text-4xl">
                {parts.seconds}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px] uppercase tracking-wider text-white/80 sm:text-xs">
        <div>
          <p className="text-white/50">Month</p>
          <p className="deskclock-led-secondary mt-0.5 font-mono text-lg">{parts.monthNumber}</p>
        </div>
        <div>
          <p className="text-white/50">Date</p>
          <p className="deskclock-led-secondary mt-0.5 font-mono text-lg">{parts.monthDay}</p>
        </div>
        <div>
          <p className="text-white/50">Day</p>
          <p className="deskclock-led-secondary mt-0.5 font-mono text-lg">{dayAbbrev}</p>
        </div>
        <div>
          <p className="text-white/50">Year</p>
          <p className="deskclock-led-secondary mt-0.5 font-mono text-lg">{parts.year}</p>
        </div>
      </div>
    </div>
  );
}

function AnalogFace({
  now,
  timezone,
  accent,
  dateLabel,
}: {
  now: Date;
  timezone: string;
  accent: string;
  dateLabel: string;
}) {
  const angles = analogHandAngles(now, timezone);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative">
      <p className="absolute left-0 top-0 text-xs text-muted">{dateLabel}</p>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto mt-4"
        aria-label={`Analog clock showing ${dateLabel}`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={size / 2 - 4}
          fill="var(--background-elevated)"
          stroke="var(--border)"
          strokeWidth="4"
        />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x1 = cx + (size / 2 - 20) * Math.cos(angle);
          const y1 = cy + (size / 2 - 20) * Math.sin(angle);
          const x2 = cx + (size / 2 - 8) * Math.cos(angle);
          const y2 = cy + (size / 2 - 8) * Math.sin(angle);
          const numAngle = (i * 30 - 90) * (Math.PI / 180);
          const nx = cx + (size / 2 - 32) * Math.cos(numAngle);
          const ny = cy + (size / 2 - 32) * Math.sin(numAngle);
          const num = i === 0 ? 12 : i;
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--foreground)" strokeWidth="2" />
              <text
                x={nx}
                y={ny}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--foreground)"
                fontSize="12"
                fontWeight="600"
              >
                {num}
              </text>
            </g>
          );
        })}
        <Hand cx={cx} cy={cy} length={50} width={4} angle={angles.hour} color="var(--foreground)" />
        <Hand cx={cx} cy={cy} length={70} width={3} angle={angles.minute} color="var(--foreground)" />
        <Hand cx={cx} cy={cy} length={78} width={1.5} angle={angles.second} color={accent} />
        <circle cx={cx} cy={cy} r={4} fill={accent} />
      </svg>
    </div>
  );
}

function Hand({
  cx,
  cy,
  length,
  width,
  angle,
  color,
}: {
  cx: number;
  cy: number;
  length: number;
  width: number;
  angle: number;
  color: string;
}) {
  return (
    <line
      x1={cx}
      y1={cy}
      x2={cx}
      y2={cy - length}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      transform={`rotate(${angle} ${cx} ${cy})`}
    />
  );
}
