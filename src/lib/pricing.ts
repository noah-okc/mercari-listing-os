/**
 * 相場分析。
 *
 * 方針:
 * - 価格案の根拠は「売却済み価格」のみ。出品価格は参考値（売れるとは限らない）として別集計。
 * - 売却済みデータが MIN_SOLD_SAMPLES 件未満なら「相場不明」とし、分位点・中央値・価格案を出さない。
 * - 分位点は線形補間（Excel の PERCENTILE.INC / R type 7 と同じ方式）。
 * - 価格案: 即売れ = 第1四分位(P25)、適正 = 中央値(P50)、強気 = 第3四分位(P75)。10円単位で四捨五入。
 */

import type { Comparable, Condition, PriceType } from "./types";

export const MIN_SOLD_SAMPLES = 5;
/** メルカリの出品可能な最低価格 */
export const MIN_LISTING_PRICE = 300;

export interface PriceStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  p25: number;
  median: number;
  p75: number;
}

export interface PriceSuggestion {
  key: "quick" | "fair" | "ambitious";
  label: string;
  price: number;
  basis: string;
}

export type AnalysisFilter = {
  /** 取得日がこの日数以内のものだけ使う。null で全期間 */
  withinDays: number | null;
  /** 指定すると同じ状態の比較対象だけを使う */
  condition: Condition | null;
  /** 今日（テスト用に注入可能） */
  today?: Date;
};

export interface MarketAnalysis {
  status: "ok" | "insufficient";
  /** フィルタ後に価格案の計算に使った売却済みデータ */
  soldUsed: Comparable[];
  /** フィルタ後の出品中データ（参考） */
  listedUsed: Comparable[];
  /** フィルタで除外された件数 */
  excludedCount: number;
  soldStats: PriceStats | null;
  listedStats: PriceStats | null;
  suggestions: PriceSuggestion[];
  /** 画面に表示する計算根拠の説明 */
  notes: string[];
}

/** 線形補間による分位点（q: 0〜1）。values は空でないこと */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) throw new Error("quantile of empty array");
  const sorted = [...values].sort((a, b) => a - b);
  const clampedQ = Math.min(1, Math.max(0, q));
  const pos = (sorted.length - 1) * clampedQ;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

export function computeStats(values: readonly number[]): PriceStats | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: sum / values.length,
    p25: quantile(values, 0.25),
    median: quantile(values, 0.5),
    p75: quantile(values, 0.75),
  };
}

export function roundPrice(value: number): number {
  return Math.max(MIN_LISTING_PRICE, Math.round(value / 10) * 10);
}

function daysBetween(ymd: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const then = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((now - then) / 86_400_000);
}

export function isValidComparable(c: Pick<Comparable, "price" | "priceType">): boolean {
  return Number.isFinite(c.price) && c.price > 0 && (c.priceType === "sold" || c.priceType === "listed");
}

export function filterComparables(
  comps: readonly Comparable[],
  filter: AnalysisFilter,
): { used: Comparable[]; excluded: number } {
  const today = filter.today ?? new Date();
  const used = comps.filter((c) => {
    if (!isValidComparable(c)) return false;
    if (filter.condition && c.condition !== filter.condition) return false;
    if (filter.withinDays !== null) {
      const d = daysBetween(c.observedAt, today);
      if (d === null || d > filter.withinDays) return false;
    }
    return true;
  });
  return { used, excluded: comps.length - used.length };
}

const pricesOf = (comps: Comparable[], type: PriceType) =>
  comps.filter((c) => c.priceType === type).map((c) => c.price);

export function analyzeMarket(
  comps: readonly Comparable[],
  filter: AnalysisFilter = { withinDays: null, condition: null },
): MarketAnalysis {
  const { used, excluded } = filterComparables(comps, filter);
  const soldUsed = used.filter((c) => c.priceType === "sold");
  const listedUsed = used.filter((c) => c.priceType === "listed");
  const soldPrices = pricesOf(used, "sold");
  const listedPrices = pricesOf(used, "listed");
  const listedStats = listedPrices.length >= MIN_SOLD_SAMPLES ? computeStats(listedPrices) : null;

  const notes: string[] = [];
  if (excluded > 0) notes.push(`絞り込み条件により ${excluded} 件を除外しました。`);
  notes.push("価格案は「売却済み価格」のみから算出し、出品価格は参考値として別に表示しています。");

  if (soldPrices.length < MIN_SOLD_SAMPLES) {
    notes.push(
      `売却済みデータが ${soldPrices.length} 件で、算出に必要な ${MIN_SOLD_SAMPLES} 件に足りないため相場不明としています。`,
    );
    return {
      status: "insufficient",
      soldUsed,
      listedUsed,
      excludedCount: excluded,
      soldStats: null,
      listedStats,
      suggestions: [],
      notes,
    };
  }

  const soldStats = computeStats(soldPrices)!;
  notes.push(
    `売却済み ${soldStats.count} 件の分位点（線形補間）を使用。価格は10円単位で四捨五入し、最低 ${MIN_LISTING_PRICE} 円としています。`,
  );
  const suggestions: PriceSuggestion[] = [
    {
      key: "quick",
      label: "即売れ",
      price: roundPrice(soldStats.p25),
      basis: `売却済み価格の第1四分位（P25）= ${Math.round(soldStats.p25).toLocaleString("ja-JP")}円`,
    },
    {
      key: "fair",
      label: "適正",
      price: roundPrice(soldStats.median),
      basis: `売却済み価格の中央値（P50）= ${Math.round(soldStats.median).toLocaleString("ja-JP")}円`,
    },
    {
      key: "ambitious",
      label: "強気",
      price: roundPrice(soldStats.p75),
      basis: `売却済み価格の第3四分位（P75）= ${Math.round(soldStats.p75).toLocaleString("ja-JP")}円`,
    },
  ];
  if (soldStats.max - soldStats.min > soldStats.median * 2) {
    notes.push("価格のばらつきが大きいため、状態やサイズの異なる比較対象が混ざっていないか確認してください。");
  }
  return {
    status: "ok",
    soldUsed,
    listedUsed,
    excludedCount: excluded,
    soldStats,
    listedStats,
    suggestions,
    notes,
  };
}
