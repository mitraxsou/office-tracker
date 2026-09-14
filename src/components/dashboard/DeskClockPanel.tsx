"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
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
import { DeskClockCalendar } from "./DeskClockCalendar";

type DeskClockPanelProps = {
  timezone: string;
  dayKey: string;
  monthKey: string;
  monthDays: MonthlyProgressDay[];
};

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
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
      />
    </svg>
  );
}

export function DeskClockPanel({ timezone, dayKey, monthKey, monthDays }: DeskClockPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [settings, setSettings] = useState<DeskClockSettings>(DEFAULT_DESK_CLOCK_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setSettings(readDeskClockSettings());
    setMounted(true);
  }, []);

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
      <section className="card p-4 sm:p-5" aria-hidden>
        <div className="h-32 animate-pulse rounded-lg bg-[var(--border)]/30" />
      </section>
    );
  }

  if (settings.hidden) {
    return (
      <p className="text-sm">
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={() => updateSettings({ hidden: false })}
        >
          Show desk clock
        </button>
      </p>
    );
  }

  const parts = clockPartsInTimezone(now, timezone, {
    hour12: settings.hour12,
    showSeconds: settings.showSeconds,
  });
  const accent = DESK_CLOCK_COLOR_CSS[settings.color];

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
        <p className="text-xs font-medium text-muted">Desk clock</p>
        <button
          type="button"
          className="btn-secondary inline-flex items-center justify-center p-1.5"
          aria-label="Desk clock settings"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((o) => !o)}
        >
          <GearIcon />
        </button>
      </div>

      {settingsOpen && (
        <DeskClockSettingsRow settings={settings} onChange={updateSettings} />
      )}

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-center sm:gap-8 sm:p-6">
        <div className="flex min-w-0 flex-1 justify-center">
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
        {settings.showCalendar && (
          <DeskClockCalendar monthKey={monthKey} todayKey={dayKey} monthDays={monthDays} />
        )}
      </div>
    </section>
  );
}

function DeskClockSettingsRow({
  settings,
  onChange,
}: {
  settings: DeskClockSettings;
  onChange: (patch: Partial<DeskClockSettings>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3 text-xs">
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
      <span className="mx-1 text-muted">|</span>
      {(Object.keys(DESK_CLOCK_COLOR_CSS) as DeskClockColor[]).map((color) => (
        <button
          key={color}
          type="button"
          title={color}
          aria-label={`Color ${color}`}
          className={`h-5 w-5 rounded-full border-2 ${
            settings.color === color ? "border-[var(--foreground)]" : "border-transparent"
          }`}
          style={{ backgroundColor: DESK_CLOCK_COLOR_CSS[color] }}
          onClick={() => onChange({ color })}
        />
      ))}
      <span className="mx-1 text-muted">|</span>
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
      <button
        type="button"
        className="ml-auto text-muted hover:text-accent hover:underline"
        onClick={() => onChange({ hidden: true })}
      >
        Hide desk clock
      </button>
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
