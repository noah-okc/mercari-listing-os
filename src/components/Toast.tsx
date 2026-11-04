"use client";

import { useEffect, useState } from "react";

type ToastMsg = { id: number; text: string; kind: "info" | "error" };
const EVENT = "mlos-toast";

export function toast(text: string, kind: ToastMsg["kind"] = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, kind } }));
}

export function ToastHost() {
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);
  useEffect(() => {
    let seq = 0;
    const onToast = (e: Event) => {
      const { text, kind } = (e as CustomEvent<{ text: string; kind: ToastMsg["kind"] }>).detail;
      const id = ++seq;
      setMsgs((m) => [...m, { id, text, kind }]);
      setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 3500);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {msgs.map((m) => (
        <div
          key={m.id}
          className={`pointer-events-auto max-w-md rounded-lg px-4 py-2 text-sm shadow-lg ${
            m.kind === "error" ? "bg-red-600 text-white" : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          }`}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
