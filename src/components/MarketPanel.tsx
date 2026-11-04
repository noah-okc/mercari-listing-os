"use client";

import { useMemo, useRef, useState } from "react";
import { deleteComparable, listComparables, saveComparables, saveItem } from "@/lib/db";
import { useLive } from "@/lib/useLive";
import { analyzeMarket, MIN_SOLD_SAMPLES, type AnalysisFilter, type PriceStats } from "@/lib/pricing";
import { comparablesFromCsv, comparablesToCsv, COMPARABLE_CSV_COLUMNS } from "@/lib/csv";
import { downloadBlob } from "@/lib/image";
import { formatYen, todayYmd } from "@/lib/format";
import { newId } from "@/lib/ids";
import { CONDITION_LABELS, CONDITIONS, PRICE_TYPE_LABELS, type Comparable, type Condition, type Item, type PriceType } from "@/lib/types";
import { DemoBadge, Field, YenInput } from "./ui";
import { toast } from "./Toast";

export function PriceTypeBadge({ type }: { type: PriceType }) {
  return type === "sold" ? (
    <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">売却済み</span>
  ) : (
    <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">出品中</span>
  );
}

export function useMarketAnalysis(item: Item, filter: AnalysisFilter) {
  const { data: comps } = useLive(() => listComparables(item.id), [item.id]);
  const analysis = useMemo(() => analyzeMarket(comps ?? [], filter), [comps, filter]);
  return { comps: comps ?? [], analysis };
}

const PERIODS: { value: string; label: string; days: number | null }[] = [
  { value: "all", label: "全期間", days: null },
  { value: "30", label: "30日以内", days: 30 },
  { value: "90", label: "90日以内", days: 90 },
  { value: "180", label: "180日以内", days: 180 },
];

export function MarketPanel({ item }: { item: Item }) {
  const [period, setPeriod] = useState("all");
  const [sameCondition, setSameCondition] = useState(false);
  const filter = useMemo<AnalysisFilter>(
    () => ({
      withinDays: PERIODS.find((p) => p.value === period)?.days ?? null,
      condition: sameCondition && item.condition !== "unknown" ? item.condition : null,
    }),
    [period, sameCondition, item.condition],
  );
  const { comps, analysis } = useMarketAnalysis(item, filter);
  const usedIds = useMemo(() => new Set([...analysis.soldUsed, ...analysis.listedUsed].map((c) => c.id)), [analysis]);
  const sorted = useMemo(() => [...comps].sort((a, b) => b.observedAt.localeCompare(a.observedAt)), [comps]);

  const setListingPrice = async (price: number) => {
    await saveItem({ ...item, listingPrice: price });
    toast(`出品価格を ${formatYen(price)} に設定しました`);
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-4" aria-labelledby="analysis-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="analysis-heading" className="font-bold">
            相場分析
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="m-period">
                取得日
              </label>
              <select id="m-period" className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={sameCondition}
                disabled={item.condition === "unknown"}
                onChange={(e) => setSameCondition(e.target.checked)}
              />
              同じ状態のみ（{CONDITION_LABELS[item.condition]}）
            </label>
          </div>
        </div>

        {analysis.status === "insufficient" ? (
          <div
            className="rounded-xl border-2 border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700"
            data-testid="market-unknown"
          >
            <p className="text-2xl font-bold">相場不明</p>
            <p className="mt-2 text-sm muted">
              売却済みデータ {analysis.soldUsed.length} 件 / 必要 {MIN_SOLD_SAMPLES} 件。価格案を出すには売却済みの比較対象をあと{" "}
              {MIN_SOLD_SAMPLES - analysis.soldUsed.length} 件以上登録してください。
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="price-suggestions">
            {analysis.suggestions.map((s) => (
              <li
                key={s.key}
                className={`rounded-xl border p-4 ${
                  s.key === "fair" ? "border-brand-500 bg-brand-50 dark:bg-brand-700/10" : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <p className="text-sm font-bold">{s.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums" data-testid={`suggestion-${s.key}`}>
                  {formatYen(s.price)}
                </p>
                <p className="mt-1 text-xs muted">{s.basis}</p>
                <button type="button" className="btn btn-sm mt-3" onClick={() => setListingPrice(s.price)}>
                  出品価格に設定
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatsTable title="売却済み価格（価格案の根拠）" stats={analysis.soldStats} count={analysis.soldUsed.length} />
          <StatsTable title="出品価格（参考・売れた価格ではありません）" stats={analysis.listedStats} count={analysis.listedUsed.length} />
        </div>

        <div>
          <h3 className="text-sm font-bold">計算根拠</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm muted" data-testid="analysis-notes">
            {analysis.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </section>

      <ComparableForm itemId={item.id} defaultCondition={item.condition} defaultSize={item.size} />

      <section className="card space-y-3" aria-labelledby="comps-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="comps-heading" className="font-bold">
            比較対象（{comps.length}件）
          </h2>
          <CsvButtons itemId={item.id} comps={comps} />
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm muted">比較対象はまだありません。手入力またはCSV取込で登録してください。</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[720px] text-left text-sm" data-testid="comps-table">
              <thead className="text-xs muted">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-2">区分</th>
                  <th className="py-2 pr-2 text-right">価格</th>
                  <th className="py-2 pr-2">取得日</th>
                  <th className="py-2 pr-2">情報源</th>
                  <th className="py-2 pr-2">状態</th>
                  <th className="py-2 pr-2">サイズ</th>
                  <th className="py-2 pr-2">タイトル / URL</th>
                  <th className="py-2 pr-2">計算</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="[&_td]:whitespace-nowrap">
                {sorted.map((c) => (
                  <tr key={c.id} className={`border-b border-zinc-100 dark:border-zinc-800/60 ${usedIds.has(c.id) ? "" : "opacity-50"}`}>
                    <td className="py-2 pr-2">
                      <div className="flex gap-1">
                        <PriceTypeBadge type={c.priceType} />
                        {c.isDemo && <DemoBadge />}
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right font-medium tabular-nums">{formatYen(c.price)}</td>
                    <td className="py-2 pr-2 tabular-nums">{c.observedAt}</td>
                    <td className="py-2 pr-2">{c.source}</td>
                    <td className="py-2 pr-2">{CONDITION_LABELS[c.condition]}</td>
                    <td className="py-2 pr-2">{c.size || "—"}</td>
                    <td className="max-w-[220px] py-2 pr-2">
                      <div className="truncate">{c.title || "—"}</div>
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-xs text-blue-600 underline dark:text-blue-400">
                          {c.url}
                        </a>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-xs">{usedIds.has(c.id) ? (c.priceType === "sold" ? "使用" : "参考") : "除外"}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        aria-label="比較対象を削除"
                        onClick={async () => {
                          if (confirm("この比較対象を削除しますか？")) await deleteComparable(c.id);
                        }}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatsTable({ title, stats, count }: { title: string; stats: PriceStats | null; count: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-sm font-bold">{title}</p>
      {stats ? (
        <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-sm">
          {(
            [
              ["件数", `${stats.count}件`],
              ["最小", formatYen(stats.min)],
              ["最大", formatYen(stats.max)],
              ["P25", formatYen(stats.p25)],
              ["中央値", formatYen(stats.median)],
              ["P75", formatYen(stats.p75)],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs muted">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm muted">
          {count}件（{MIN_SOLD_SAMPLES}件未満のため統計値は算出しません）
        </p>
      )}
    </div>
  );
}

function CsvButtons({ itemId, comps }: { itemId: string; comps: Comparable[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([]);

  const onImport = async (file: File) => {
    const text = await file.text();
    const result = comparablesFromCsv(text, { defaultItemId: itemId });
    // この画面からの取込は、表示中の商品のデータとして扱う
    const mine = result.comparables.map((c) => ({ ...c, itemId }));
    if (mine.length) await saveComparables(mine);
    setErrors(result.errors);
    toast(`${mine.length}件取り込みました${result.errors.length ? `（${result.errors.length}件エラー）` : ""}`, result.errors.length ? "error" : "info");
  };

  return (
    <div className="w-full sm:w-auto">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
          CSV取込
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={comps.length === 0}
          onClick={() => downloadBlob(new Blob([comparablesToCsv(comps)], { type: "text/csv;charset=utf-8" }), `comparables-${itemId.slice(0, 8)}.csv`)}
        >
          CSV出力
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() =>
            downloadBlob(
              new Blob(
                [
                  "﻿" +
                    COMPARABLE_CSV_COLUMNS.join(",") +
                    "\r\n" +
                    `,商品タイトル例,3000,sold,${todayYmd()},メルカリ 手動確認,no_noticeable_damage,M,https://example.com/item,メモ\r\n`,
                ],
                { type: "text/csv;charset=utf-8" },
              ),
              "comparables-template.csv",
            )
          }
        >
          CSVひな形
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label="相場CSVを選択"
          data-testid="csv-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = "";
          }}
        />
      </div>
      {errors.length > 0 && (
        <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300" role="alert">
          {errors.map((er) => (
            <li key={`${er.line}-${er.message}`}>
              {er.line}行目: {er.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ComparableForm({ itemId, defaultCondition, defaultSize }: { itemId: string; defaultCondition: Condition; defaultSize: string }) {
  const blank = () => ({
    title: "",
    price: null as number | null,
    priceType: "" as PriceType | "",
    observedAt: todayYmd(),
    source: "",
    condition: defaultCondition,
    size: defaultSize,
    url: "",
    note: "",
  });
  const [v, setV] = useState(blank);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.price || v.price <= 0) return setError("価格を入力してください");
    if (!v.priceType) return setError("「売却済み価格」か「出品価格」かを選んでください");
    if (!v.observedAt) return setError("取得日を入力してください");
    if (!v.source.trim()) return setError("情報源を入力してください");
    if (v.url && !/^https?:\/\//i.test(v.url.trim())) return setError("URLは http:// または https:// で始めてください");
    setError(null);
    const comp: Comparable = {
      id: newId(),
      itemId,
      title: v.title.trim(),
      price: v.price,
      priceType: v.priceType,
      observedAt: v.observedAt,
      source: v.source.trim(),
      condition: v.condition,
      size: v.size.trim(),
      url: v.url.trim(),
      note: v.note.trim(),
      isDemo: false,
      createdAt: new Date().toISOString(),
    };
    await saveComparables([comp]);
    toast("比較対象を追加しました");
    setV({ ...blank(), source: v.source, priceType: v.priceType, observedAt: v.observedAt });
  };

  return (
    <section className="card" aria-labelledby="comp-form-heading">
      <h2 id="comp-form-heading" className="font-bold">
        比較対象を手入力
      </h2>
      <p className="mt-1 text-xs muted">
        自分で確認した価格のみを入力してください。本アプリはメルカリ等から自動取得（スクレイピング）を行いません。
      </p>
      <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="比較対象の追加">
        <fieldset className="sm:col-span-2">
          <legend className="label">価格の区分（必須）</legend>
          <div className="flex flex-wrap gap-2">
            {(["sold", "listed"] as const).map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  v.priceType === t ? "border-brand-500 bg-brand-50 dark:bg-brand-700/10" : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <input type="radio" name="priceType" value={t} checked={v.priceType === t} onChange={() => setV({ ...v, priceType: t })} />
                {PRICE_TYPE_LABELS[t]}
                <span className="text-xs muted">{t === "sold" ? "（実際に売れた価格）" : "（売れていない出品中の価格）"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="価格（必須）" htmlFor="c-price">
          <YenInput id="c-price" value={v.price} onChange={(n) => setV({ ...v, price: n })} />
        </Field>
        <Field label="取得日（必須）" htmlFor="c-date">
          <input id="c-date" type="date" className="input" value={v.observedAt} max={todayYmd()} onChange={(e) => setV({ ...v, observedAt: e.target.value })} />
        </Field>
        <Field label="情報源（必須）" htmlFor="c-source">
          <input id="c-source" className="input" placeholder="例: メルカリで目視確認" value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} />
        </Field>
        <Field label="状態" htmlFor="c-cond">
          <select id="c-cond" className="input" value={v.condition} onChange={(e) => setV({ ...v, condition: e.target.value as Condition })}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="サイズ" htmlFor="c-size">
          <input id="c-size" className="input" value={v.size} onChange={(e) => setV({ ...v, size: e.target.value })} />
        </Field>
        <Field label="タイトル" htmlFor="c-title">
          <input id="c-title" className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="URL" htmlFor="c-url">
            <input id="c-url" type="url" className="input" placeholder="https://" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="メモ" htmlFor="c-note">
            <input id="c-note" className="input" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-end justify-end gap-3 sm:col-span-2 lg:col-span-4">
          {error && (
            <p className="mr-auto text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary">
            追加する
          </button>
        </div>
      </form>
    </section>
  );
}
