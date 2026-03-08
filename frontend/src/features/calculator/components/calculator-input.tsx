/**
 * Calculator Input Component
 *
 * Standardized input component for calculator forms with validation and formatting.
 */

"use client";

import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/utils/helpers/utils";

interface CalculatorInputProps {
  label: string;
  name: string;
  value: number;
  onChange: (_value: number) => void;
  type?: "number" | "currency" | "percentage";
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
}

export function CalculatorInput({
  label,
  name,
  value,
  onChange,
  type = "number",
  placeholder,
  required = false,
  min,
  max,
  step,
  suffix,
  prefix,
  error,
  className,
  disabled = false,
}: CalculatorInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (type === "currency" || type === "percentage") {
      // Remove non-numeric characters except decimal point
      const numericValue = inputValue.replace(/[^\d.]/g, "");
      const num = parseFloat(numericValue) || 0;
      onChange(num);
    } else {
      const num = parseFloat(inputValue) || 0;
      onChange(num);
    }
  };

  const formatDisplayValue = (val: number): string => {
    if (isNaN(val) || val === 0) return "";

    if (type === "currency") {
      return val.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else if (type === "percentage") {
      return val.toFixed(2);
    }

    return val.toString();
  };

  const displayValue = value > 0 ? formatDisplayValue(value) : "";

  return (
    <div className={cn("space-y-2", className)}>
      <Label
        htmlFor={name}
        className={
          required
            ? 'after:content-["*"] after:ml-0.5 after:text-destructive'
            : ""
        }
      >
        {label}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={name}
          name={name}
          type="text"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={cn(
            prefix && "pl-8",
            suffix && "pr-8",
            error && "border-destructive",
            "w-full"
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
