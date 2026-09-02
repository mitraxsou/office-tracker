"use client";

type SsidManualInputProps = {
  value: string;
  onChange: (value: string) => void;
  officeSsids?: string[];
  id?: string;
};

export function SsidManualInput({
  value,
  onChange,
  officeSsids = [],
  id,
}: SsidManualInputProps) {
  const hints = [...new Set(officeSsids.map((s) => s.trim()).filter(Boolean))];

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        Network (SSID)
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="OfficeConnect, pwcglb.com, or Ethernet"
        className="w-full rounded-lg border px-3 py-2"
      />
      <p className="mt-1 text-xs text-muted">
        Type the Wi-Fi name or connection you used. Any value is accepted.
      </p>
      {hints.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted">Quick fill from common office networks:</p>
          <div className="flex flex-wrap gap-1.5">
            {hints.map((ssid) => (
              <button
                key={ssid}
                type="button"
                onClick={() => onChange(ssid)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  value === ssid
                    ? "bg-[var(--pwc-orange)] text-white"
                    : "border border-[var(--border)] text-muted hover:border-[var(--pwc-orange)] hover:text-accent"
                }`}
              >
                {ssid}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
