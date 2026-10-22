"use client";

import { STATEMENT_TEXT } from "@amanah/shared";

// Displays the canonical consent statement. The checkbox gates submission only;
// the consentHash itself is derived from the exact donate args in the engine.
export function ConsentBox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm text-foreground-soft">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 shrink-0"
      />
      <span>{STATEMENT_TEXT}</span>
    </label>
  );
}
