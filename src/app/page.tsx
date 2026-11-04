"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { listItems } from "@/lib/db";
import { useLive } from "@/lib/useLive";
import { DEFAULT_QUERY, itemDisplayName, queryItems, SORT_LABELS, type ItemQuery, type SortKey } from "@/lib/itemQuery";
import { ITEM_STATUSES, STATUS_LABELS, type ItemStatus } from "@/lib/types";
import { formatYen } from "@/lib/format";
import { DemoBadge, EmptyState, StatusBadge } from "@/components/ui";
import { PhotoThumb } from "@/components/PhotoThumb";

export default function ItemListPage() {
  const { data: items, loading, error } = useLive(listItems, []);
  const [q, setQ] = useState<ItemQuery>(DEFAULT_QUERY);
  const results = useMemo(() => queryItems(items ?? [], q), [items, q]);

  const counts = useMemo(() => {
    const c: Record<ItemStatus | "all", number> = { all: 0, draft: 0, listed: 0, sold: 0 };
    for (const i of items ?? []) {
      c.all++;
      c[i.status]++;
    }
    return c;
  }, [items]);
  const hasDemo = (items ?? []).some((i) => i.isDemo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">商品一覧</h1>
          <p className="text-sm muted">
            全 {counts.all} 件 ・ 下書き {counts.draft} ・ 出品中 {counts.listed} ・ 売却済み {counts.sold}
          </p>
        </div>
        <Link href="/items/new" className="btn btn-primary">
          ＋ 商品を登録
        </Link>
      </div>

      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="label" htmlFor="search">
            検索
          </label>
          <input
            id="search"
            type="search"
            className="input"
            placeholder="ブランド・商品名・型番・ID"
            value={q.text}
            onChange={(e) => setQ({ ...q, text: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="status-filter">
            ステータス
          </label>
          <select
            id="status-filter"
            className="input"
            value={q.status}
            onChange={(e) => setQ({ ...q, status: e.target.value as ItemQuery["status"] })}
          >
            <option value="all">すべて</option>
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}（{counts[s]}）
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="kind-filter">
            データ種別
          </label>
          <select
            id="kind-filter"
            className="input"
            value={q.dataKind}
            onChange={(e) => setQ({ ...q, dataKind: e.target.value as ItemQuery["dataKind"] })}
          >
            <option value="all">すべて</option>
            <option value="real">実データのみ</option>
            <option value="demo">デモデータのみ</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sort">
            並べ替え
          </label>
          <select id="sort" className="input" value={q.sort} onChange={(e) => setQ({ ...q, sort: e.target.value as SortKey })}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasDemo && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          「デモ」表示の商品と相場データは架空のものです。実在の成約価格ではありません。削除は
          <Link href="/data" className="underline">
            データ管理
          </Link>
          から行えます。
        </p>
      )}

      {error && <p className="text-red-600">読み込みに失敗しました: {error.message}</p>}
      {loading && !items ? (
        <p className="muted">読み込み中…</p>
      ) : results.length === 0 ? (
        counts.all === 0 ? (
          <EmptyState title="まだ商品がありません">
            <p>「商品を登録」から始めるか、
              <Link href="/data" className="underline">
                データ管理
              </Link>
              でデモデータを読み込んで操作を試せます。
            </p>
          </EmptyState>
        ) : (
          <EmptyState title="条件に一致する商品がありません" />
        )
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="item-list">
          {results.map((item) => (
            <li key={item.id}>
              <Link
                href={`/items/${item.id}`}
                className="card flex gap-3 transition hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <PhotoThumb photoId={item.photoIds[0]} alt={itemDisplayName(item)} className="size-20 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge status={item.status} />
                    {item.isDemo && <DemoBadge />}
                  </div>
                  <p className="mt-1 truncate font-medium">{itemDisplayName(item)}</p>
                  <p className="truncate text-xs muted">
                    {[item.modelNumber, item.size].filter(Boolean).join(" / ") || "型番・サイズ未入力"}
                  </p>
                  <p className="mt-1 text-xs muted">
                    仕入れ {formatYen(item.purchasePrice)}
                    {item.status === "sold"
                      ? ` ・ 売却 ${formatYen(item.soldPrice)}`
                      : item.listingPrice !== null
                        ? ` ・ 出品 ${formatYen(item.listingPrice)}`
                        : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
