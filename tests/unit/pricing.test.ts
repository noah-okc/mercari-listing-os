import { describe, expect, it } from "vitest";
import { analyzeMarket, computeStats, MIN_SOLD_SAMPLES, quantile, roundPrice } from "@/lib/pricing";
import type { Comparable, Condition, PriceType } from "@/lib/types";

const ITEM = "11111111-1111-4111-8111-111111111111";
let seq = 0;
function comp(price: number, priceType: PriceType, observedAt = "2026-10-01", condition: Condition = "no_noticeable_damage"): Comparable {
  return {
    id: `c${seq++}`,
    itemId: ITEM,
    title: "",
    price,
    priceType,
    observedAt,
    source: "テスト",
    condition,
    size: "",
    url: "",
    note: "",
    isDemo: false,
    createdAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("quantile", () => {
  it("線形補間（PERCENTILE.INC と同じ）で計算する", () => {
    const v = [1, 2, 3, 4, 5];
    expect(quantile(v, 0)).toBe(1);
    expect(quantile(v, 0.25)).toBe(2);
    expect(quantile(v, 0.5)).toBe(3);
    expect(quantile(v, 1)).toBe(5);
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(quantile([10, 20, 30, 40], 0.25)).toBe(17.5);
  });
  it("入力順に依存しない", () => {
    expect(quantile([5, 1, 4, 2, 3], 0.75)).toBe(4);
  });
  it("空配列はエラー", () => {
    expect(() => quantile([], 0.5)).toThrow();
  });
});

describe("computeStats", () => {
  it("件数・最小・最大・平均・分位点を返す", () => {
    const s = computeStats([3000, 3200, 3500, 2800, 4000])!;
    expect(s).toMatchObject({ count: 5, min: 2800, max: 4000, median: 3200, p25: 3000, p75: 3500 });
    expect(s.mean).toBe(3300);
  });
});

describe("roundPrice", () => {
  it("10円単位に丸め、最低300円", () => {
    expect(roundPrice(3254)).toBe(3250);
    expect(roundPrice(3255)).toBe(3260);
    expect(roundPrice(120)).toBe(300);
  });
});

describe("analyzeMarket", () => {
  it(`売却済みが${MIN_SOLD_SAMPLES}件未満なら相場不明で価格案を出さない`, () => {
    const comps = [comp(3000, "sold"), comp(3200, "sold"), comp(3500, "sold"), comp(3300, "sold"), ...Array.from({ length: 10 }, () => comp(5000, "listed"))];
    const a = analyzeMarket(comps);
    expect(a.status).toBe("insufficient");
    expect(a.suggestions).toEqual([]);
    expect(a.soldStats).toBeNull();
    expect(a.notes.join()).toContain("相場不明");
  });

  it("出品価格は価格案の計算に使わない", () => {
    const sold = [2800, 3000, 3200, 3500, 4000].map((p) => comp(p, "sold"));
    const listed = [9000, 9500, 9900].map((p) => comp(p, "listed"));
    const a = analyzeMarket([...sold, ...listed]);
    expect(a.status).toBe("ok");
    expect(a.soldStats!.median).toBe(3200);
    expect(a.suggestions.map((s) => [s.key, s.price])).toEqual([
      ["quick", 3000],
      ["fair", 3200],
      ["ambitious", 3500],
    ]);
    expect(a.listedUsed).toHaveLength(3);
    // 出品中が5件未満なので出品価格の統計も出さない
    expect(a.listedStats).toBeNull();
  });

  it("価格案は 即売れ ≤ 適正 ≤ 強気 の順になる", () => {
    const a = analyzeMarket([1200, 5000, 3100, 2900, 4100, 3600, 2000].map((p) => comp(p, "sold")));
    const [q, f, s] = a.suggestions.map((x) => x.price);
    expect(q).toBeLessThanOrEqual(f);
    expect(f).toBeLessThanOrEqual(s);
  });

  it("期間・状態で絞り込み、除外件数を根拠に記載する", () => {
    const today = new Date(2026, 10, 4);
    const comps = [
      ...[3000, 3100, 3200, 3300, 3400].map((p) => comp(p, "sold", "2026-10-20")),
      comp(9999, "sold", "2025-01-01"),
      comp(100, "sold", "2026-10-20", "poor"),
    ];
    const a = analyzeMarket(comps, { withinDays: 90, condition: "no_noticeable_damage", today });
    expect(a.status).toBe("ok");
    expect(a.excludedCount).toBe(2);
    expect(a.soldStats!.max).toBe(3400);
    expect(a.notes.join()).toContain("2 件を除外");
  });

  it("不正な価格や日付のデータは使わない", () => {
    const a = analyzeMarket([comp(0, "sold"), comp(-5, "sold"), comp(Number.NaN, "sold")], { withinDays: 30, condition: null });
    expect(a.status).toBe("insufficient");
    expect(a.soldUsed).toHaveLength(0);
  });
});
