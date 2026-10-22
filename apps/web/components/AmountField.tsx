"use client";

import { Input } from "@amanah/ui/input";
import { Label } from "@amanah/ui/label";

export function AmountField({
  id = "amount",
  label = "Amount",
  value,
  onChange,
  error,
  disabled,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
