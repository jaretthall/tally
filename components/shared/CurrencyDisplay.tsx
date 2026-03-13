"use client";

import { centsToDisplay } from "@/lib/money";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  cents: number;
  size?: "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  colorize?: boolean; // Green if positive, red if negative
  showSign?: boolean;
  className?: string;
}

export function CurrencyDisplay({
  cents,
  size = "base",
  colorize = false,
  showSign = false,
  className,
}: CurrencyDisplayProps) {
  const sizeClass = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
    xl: "text-xl",
    "2xl": "text-2xl",
    "3xl": "text-3xl",
    "4xl": "text-4xl",
    "5xl": "text-5xl",
  }[size];

  const colorClass = colorize
    ? cents > 0
      ? "text-green-600"
      : cents < 0
      ? "text-red-600"
      : "text-slate-900"
    : "";

  const display = showSign && cents > 0
    ? `+${centsToDisplay(cents)}`
    : centsToDisplay(cents);

  return (
    <span className={cn("font-mono tabular-nums", sizeClass, colorClass, className)}>
      {display}
    </span>
  );
}
