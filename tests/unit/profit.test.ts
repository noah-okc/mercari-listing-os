import { describe, expect, it } from "vitest";
import { calcBreakEvenPrice, calcFee, calcProfit } from "@/lib/profit";

describe("calcFee", () => {
  it("10%手数料を1円未満切り捨てで計算する", () => {
    expect(calcFee(1000, 0.1)).toBe(100);
    expect(calcFee(1234, 0.1)).toBe(123);
    expect(calcFee(999, 0.1)).toBe(99);
  });
  it("浮動小数点誤差で1円ずれない", () => {
    // 3300 * 0.1 = 330.00000000000006 になる環境でも 330
    expect(calcFee(3300, 0.1)).toBe(330);
    expect(calcFee(700, 0.07)).toBe(49);
  });
  it("負や不正な値は0として扱う", () => {
    expect(calcFee(-100, 0.1)).toBe(0);
    expect(calcFee(1000, Number.NaN)).toBe(0);
  });
});

describe("calcProfit", () => {
  it("手取り金額と純利益を別々に算出する", () => {
    const r = calcProfit({ salePrice: 3000, feeRate: 0.1, shippingCost: 750, packagingCost: 50, purchasePrice: 1000 });
    expect(r.fee).toBe(300);
    expect(r.payout).toBe(1950); // 3000 - 300 - 750
    expect(r.netProfit).toBe(900); // 1950 - 50 - 1000
    expect(r.marginRate).toBeCloseTo(0.3);
    expect(r.roi).toBeCloseTo(0.9);
  });
  it("赤字はマイナスで返す", () => {
    const r = calcProfit({ salePrice: 1000, feeRate: 0.1, shippingCost: 750, packagingCost: 100, purchasePrice: 500 });
    expect(r.payout).toBe(150);
    expect(r.netProfit).toBe(-450);
  });
  it("販売価格0・仕入れ値0のときは率を null にする", () => {
    const r = calcProfit({ salePrice: 0, feeRate: 0.1, shippingCost: 0, packagingCost: 0, purchasePrice: 0 });
    expect(r.marginRate).toBeNull();
    expect(r.roi).toBeNull();
  });
});

describe("calcBreakEvenPrice", () => {
  it("純利益が0以上になる最小価格を返す", () => {
    const input = { feeRate: 0.1, shippingCost: 750, packagingCost: 50, purchasePrice: 1000 };
    const p = calcBreakEvenPrice(input)!;
    expect(calcProfit({ ...input, salePrice: p }).netProfit).toBeGreaterThanOrEqual(0);
    expect(calcProfit({ ...input, salePrice: p - 1 }).netProfit).toBeLessThan(0);
    // 1999 - floor(199.9)=199 - 750 - 50 - 1000 = 0（手数料の切り捨てにより2000円より1円安い）
    expect(p).toBe(1999);
  });
  it("切り捨てを考慮した境界でも正しい", () => {
    for (const cost of [1, 99, 301, 777, 12345]) {
      const input = { feeRate: 0.1, shippingCost: 0, packagingCost: 0, purchasePrice: cost };
      const p = calcBreakEvenPrice(input)!;
      expect(calcProfit({ ...input, salePrice: p }).netProfit).toBeGreaterThanOrEqual(0);
      expect(calcProfit({ ...input, salePrice: p - 1 }).netProfit).toBeLessThan(0);
    }
  });
  it("費用0なら0円、手数料100%なら算出不可", () => {
    expect(calcBreakEvenPrice({ feeRate: 0.1, shippingCost: 0, packagingCost: 0, purchasePrice: 0 })).toBe(0);
    expect(calcBreakEvenPrice({ feeRate: 1, shippingCost: 100, packagingCost: 0, purchasePrice: 0 })).toBeNull();
  });
});
