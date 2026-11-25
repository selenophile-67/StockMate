import React from 'react';
import { formatINR } from '../lib/finance';

export interface CalcFieldProps {
  label: string;
  value: number | string;
  onChange: (val: string) => void;
  type?: 'number' | 'text' | 'date';
  min?: number;
  max?: number;
  step?: string;
  prefix?: string;
  suffix?: string;
  hint?: string;
}

export function CalcField({
  label,
  value,
  onChange,
  type = 'number',
  min = 0,
  max,
  step = 'any',
  prefix,
  suffix,
  hint,
}: CalcFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-xs font-mono text-slate-500 dark:text-slate-400 pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type={type}
          min={type === 'number' ? min : undefined}
          max={type === 'number' ? max : undefined}
          step={type === 'number' ? step : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            prefix ? 'pl-7' : 'pl-3'
          } ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && (
          <span className="absolute right-3 text-xs font-mono text-slate-500 dark:text-slate-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export function ResultMetric({
  label,
  value,
  tone = 'neutral',
  subtext,
  large = false,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral' | 'accent';
  subtext?: string;
  large?: boolean;
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-[#22C55E]'
      : tone === 'negative'
        ? 'text-red-600 dark:text-[#EF4444]'
        : tone === 'accent'
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-slate-900 dark:text-slate-50';

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120] p-3.5">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={`mt-1 font-bold font-mono tabular-nums ${
          large ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
        } ${toneClass}`}
      >
        {value}
      </div>
      {subtext && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtext}</div>
      )}
    </div>
  );
}

export function BreakdownRow({
  label,
  value,
  bold = false,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  bold?: boolean;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const display = typeof value === 'number' ? formatINR(value) : value;
  const color =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-[#22C55E]'
      : tone === 'negative'
        ? 'text-red-600 dark:text-[#EF4444]'
        : 'text-slate-900 dark:text-slate-100';

  return (
    <div
      className={`flex items-center justify-between py-2 text-xs ${
        bold ? 'font-semibold border-t border-slate-200 dark:border-slate-800 pt-2.5' : ''
      }`}
    >
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className={`font-mono tabular-nums ${color}`}>{display}</span>
    </div>
  );
}
