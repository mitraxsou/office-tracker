"use client";

import { useEffect, useId, useState } from "react";

type DateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

function splitDateTime(value: string) {
  if (!value) return { date: "", time: "" };
  const [date, time] = value.split("T");
  return { date: date ?? "", time: (time ?? "").slice(0, 5) };
}

function combineDateTime(date: string, time: string) {
  if (!date) return "";
  return `${date}T${time || "09:00"}`;
}

export function DateTimeField({ label, value, onChange, required }: DateTimeFieldProps) {
  const id = useId();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    const parts = splitDateTime(value);
    setDate(parts.date);
    setTime(parts.time);
  }, [value]);

  function update(nextDate: string, nextTime: string) {
    setDate(nextDate);
    setTime(nextTime);
    onChange(combineDateTime(nextDate, nextTime));
  }

  return (
    <div>
      <p className="mb-1 block text-sm text-muted">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          id={`${id}-date`}
          type="date"
          required={required}
          value={date}
          onChange={(e) => update(e.target.value, time)}
          className="picker-input w-full rounded-lg border px-3 py-2"
        />
        <input
          id={`${id}-time`}
          type="time"
          required={required}
          value={time}
          onChange={(e) => update(date, e.target.value)}
          className="picker-input w-full rounded-lg border px-3 py-2"
        />
      </div>
    </div>
  );
}

export function dateTimeLocalToIso(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}

export function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
