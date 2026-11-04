"use client";

import { useState } from "react";
import { calcBreakEvenPrice, calcProfit } from "@/lib/profit";
import { formatPercent, formatYen } from "@/lib/format";
import type { ProfitSettings } from "@/lib/types";
import { Field, YenInput } from "./ui";

export interface ProfitValues extends ProfitSettings {
  salePrice: number | null;
  purchasePrice: number | null;
}

export function ProfitCalculator({
  initial,
  quickPrices,
  onSave,
  saveLabel = "この条件を保存",
}: {
  initial: ProfitValues;
  /** 価格案などワンタップで入れられる候補 */
  quickPrices?: { label: string; price: number }[];
  onSave?: (v: ProfitValues) => Promise<void> | void;
  saveLabel?: string;
}) {
  const [v, setV] = useState<ProfitValues>(initial);
  const [feePercentText, setFeePercentText] = useState(String(+(initial.feeRate * 100).toFixed(2)));

  const input = {
    salePrice: v.salePrice ?? 0,
    feeRate: v.feeRate,
    shippingCost: v.shippingCost,
    packagingCost: v.packagingCost,
    purchasePrice: v.purchasePrice ?? 0,
  };
  // 入力のたびに再計算（計算は軽量なのでメモ化不要）
  const result = calcProfit(input);
  const breakEven = calcBreakEvenPrice(input);
  const hasPrice = v.salePrice !== null && v.salePrice > 0;
  const profitPositive = result.netProfit >= 0;
  // 販売価格が未入力のときは、価格0円として計算した値（大きなマイナス）を見せない
  const yen = (n: number) => (hasPrice ? formatYen(n) : "—");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <Field label="販売価格" htmlFor="p-sale">
          <YenInput id="p-sale" value={v.salePrice} onChange={(n) => setV({ ...v, salePrice: n })} placeholder="例: 3000" />
        </Field>
        {quickPrices && quickPrices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quickPrices.map((q) => (
              <button key={q.label} type="button" className="btn btn-sm" onClick={() => setV({ ...v, salePrice: q.price })}>
                {q.label} {formatYen(q.price)}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="販売手数料率（%）" htmlFor="p-fee">
            <input
              id="p-fee"
              className="input"
              inputMode="decimal"
              value={feePercentText}
              onChange={(e) => {
                setFeePercentText(e.target.value);
                const n = Number(e.target.value.normalize("NFKC"));
                if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= 0 && n < 100) setV({ ...v, feeRate: n / 100 });
              }}
            />
          </Field>
          <Field label="送料" htmlFor="p-ship">
            <YenInput id="p-ship" value={v.shippingCost} allowEmpty={false} onChange={(n) => setV({ ...v, shippingCost: n ?? 0 })} />
          </Field>
          <Field label="梱包費" htmlFor="p-pack">
            <YenInput id="p-pack" value={v.packagingCost} allowEmpty={false} onChange={(n) => setV({ ...v, packagingCost: n ?? 0 })} />
          </Field>
          <Field label="仕入れ値" htmlFor="p-cost">
            <YenInput id="p-cost" value={v.purchasePrice} onChange={(n) => setV({ ...v, purchasePrice: n })} />
          </Field>
        </div>
        {onSave && (
          <button type="button" className="btn" onClick={() => onSave(v)}>
            {saveLabel}
          </button>
        )}
      </div>

      <div className="space-y-3" aria-live="polite">
        <dl className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          <Row label="販売価格" value={yen(input.salePrice)} />
          <Row label={`販売手数料（${formatPercent(v.feeRate, 1)}・1円未満切り捨て）`} value={hasPrice ? `− ${formatYen(result.fee)}` : "—"} />
          <Row label="送料" value={`− ${formatYen(input.shippingCost)}`} />
          <Row label="手取り金額（売上金）" value={yen(result.payout)} strong testId="payout" />
          <Row label="梱包費" value={`− ${formatYen(input.packagingCost)}`} />
          <Row label="仕入れ値" value={`− ${formatYen(input.purchasePrice)}`} />
          <Row
            label="純利益"
            value={yen(result.netProfit)}
            strong
            testId="net-profit"
            valueClass={hasPrice ? (profitPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : ""}
          />
        </dl>
        {!hasPrice && <p className="text-sm text-amber-700 dark:text-amber-300">販売価格を入力すると手取り金額と純利益を表示します。</p>}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="利益率" value={hasPrice ? formatPercent(result.marginRate) : "—"} />
          <Stat label="ROI" value={hasPrice ? formatPercent(result.roi) : "—"} />
          <Stat label="損益分岐価格" value={breakEven === null ? "算出不可" : formatYen(breakEven)} testId="break-even" />
        </div>
        <p className="text-xs muted">
          手取り金額 = 販売価格 − 販売手数料 − 送料。純利益 = 手取り金額 − 梱包費 − 仕入れ値。損益分岐価格は純利益が0円以上になる最低の販売価格です。
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong, testId, valueClass }: { label: string; value: string; strong?: boolean; testId?: string; valueClass?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 ${strong ? "bg-zinc-50 dark:bg-zinc-900/60" : ""}`}>
      <dt className={`text-sm ${strong ? "font-bold" : "muted"}`}>{label}</dt>
      <dd className={`whitespace-nowrap tabular-nums ${strong ? "text-lg font-bold" : "text-sm"} ${valueClass ?? ""}`} data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
      <div className="text-xs muted">{label}</div>
      <div className="font-bold tabular-nums" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}
