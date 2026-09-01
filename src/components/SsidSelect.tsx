"use client";

type SsidSelectProps = {
  officeSsids: string[];
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
};

export function SsidSelect({
  officeSsids,
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = "Not specified",
  className = "w-full rounded-lg border px-3 py-2",
}: SsidSelectProps) {
  const options = [
    ...new Set(
      [...officeSsids.map((s) => s.trim()).filter(Boolean), value.trim()].filter(Boolean),
    ),
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {options.map((ssid) => (
        <option key={ssid} value={ssid}>
          {ssid}
        </option>
      ))}
    </select>
  );
}
