/**
 * 利益計算。
 *
 * - 販売手数料 = floor(販売価格 × 手数料率)  … 1円未満切り捨て
 * - 手取り金額 = 販売価格 − 販売手数料 − 送料   … 売上として受け取る金額
 * - 純利益     = 手取り金額 − 梱包費 − 仕入れ値
 */

export interface ProfitInput {
  salePrice: number;
  feeRate: number;
  shippingCost: number;
  packagingCost: number;
  purchasePrice: number;
}

export interface ProfitResult {
  fee: number;
  payout: number;
  netProfit: number;
  /** 販売価格に対する純利益率。販売価格0なら null */
  marginRate: number | null;
  /** 仕入れ値に対する純利益率（ROI）。仕入れ値0なら null */
  roi: number | null;
}

function nonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function calcFee(salePrice: number, feeRate: number): number {
  const price = nonNegative(salePrice);
  const rate = clampRate(feeRate);
  // 浮動小数点誤差（例: 1000 * 0.1 = 100.00000000000001）を吸収してから切り捨て
  return Math.floor(Math.round(price * rate * 1e6) / 1e6);
}

export function clampRate(feeRate: number): number {
  if (!Number.isFinite(feeRate) || feeRate < 0) return 0;
  if (feeRate > 1) return 1;
  return feeRate;
}

export function calcProfit(input: ProfitInput): ProfitResult {
  const salePrice = nonNegative(input.salePrice);
  const shipping = nonNegative(input.shippingCost);
  const packaging = nonNegative(input.packagingCost);
  const purchase = nonNegative(input.purchasePrice);
  const fee = calcFee(salePrice, input.feeRate);
  const payout = salePrice - fee - shipping;
  const netProfit = payout - packaging - purchase;
  return {
    fee,
    payout,
    netProfit,
    marginRate: salePrice > 0 ? netProfit / salePrice : null,
    roi: purchase > 0 ? netProfit / purchase : null,
  };
}

/**
 * 損益分岐価格: 純利益が 0 以上になる最小の販売価格（円、整数）。
 * 手数料率が 100% 以上の場合は成立しないため null。
 */
export function calcBreakEvenPrice(input: Omit<ProfitInput, "salePrice">): number | null {
  const rate = clampRate(input.feeRate);
  if (rate >= 1) return null;
  const costs =
    nonNegative(input.shippingCost) + nonNegative(input.packagingCost) + nonNegative(input.purchasePrice);
  if (costs === 0) return 0;
  let price = Math.max(0, Math.floor(costs / (1 - rate)) - 2);
  const profitAt = (p: number) => calcProfit({ ...input, salePrice: p }).netProfit;
  while (profitAt(price) < 0) price += 1;
  while (price > 0 && profitAt(price - 1) >= 0) price -= 1;
  return price;
}
