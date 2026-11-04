"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "mlos-theme";
const LABELS: Record<Theme, string> = { system: "自動", light: "ライト", dark: "ダーク" };
const ICONS: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };
const ORDER: Theme[] = ["system", "light", "dark"];

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    let saved: Theme = "system";
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark" || v === "system") saved = v;
    } catch {}
    setTheme(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let current: string | null = null;
      try {
        current = localStorage.getItem(KEY);
      } catch {}
      if (!current || current === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const next = () => {
    const t = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
    apply(t);
  };

  return (
    <button type="button" onClick={next} className="btn btn-sm shrink-0" aria-label={`テーマ: ${LABELS[theme]}（クリックで切替）`} title="テーマ切替">
      <span aria-hidden>{ICONS[theme]}</span>
      <span className="hidden sm:inline">{LABELS[theme]}</span>
    </button>
  );
}
