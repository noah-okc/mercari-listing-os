"use client";

import type { ItemStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { parseYenInput } from "@/lib/format";
import { useEffect, useState } from "react";

export function StatusBadge({ status }: { status: ItemStatus }) {
  const cls: Record<ItemStatus, string> = {
    draft: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    listed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    sold: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  };
  return <span className={`badge ${cls[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function DemoBadge() {
  return (
    <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" title="架空のデモデータです">
      デモ
    </span>
  );
}

/** 円入力。全角数字・カンマも受け付け、確定値を number | null で返す */
export function YenInput({
  value,
  onChange,
  id,
  placeholder,
  ariaLabel,
  allowEmpty = true,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => {
    const parsed = parseYenInput(text);
    if (parsed !== value) setText(value === null ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm muted">¥</span>
      <input
        id={id}
        inputMode="numeric"
        className="input pl-7"
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseYenInput(e.target.value);
          if (parsed === null) {
            if (allowEmpty && e.target.value.trim() === "") onChange(null);
            return;
          }
          if (parsed >= 0) onChange(Math.round(parsed));
        }}
      />
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm muted">{children}</div>}
    </div>
  );
}
