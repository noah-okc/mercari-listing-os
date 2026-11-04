"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribe } from "./db";

/**
 * IndexedDB のクエリ結果を購読するフック。DB 変更時（別タブ含む）に自動で再取得する。
 */
export function useLive<T>(query: () => Promise<T>, deps: unknown[]): { data: T | undefined; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    let cancelled = false;
    queryRef
      .current()
      .then((v) => {
        if (!cancelled) {
          setData(v);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, deps);

  useEffect(() => {
    let cancel = run();
    const unsub = subscribe(() => {
      cancel();
      cancel = run();
    });
    return () => {
      cancel();
      unsub();
    };
  }, [run]);

  return { data, loading, error };
}
