"use client";

import { ProfitCalculator } from "@/components/ProfitCalculator";
import { DEFAULT_PROFIT_SETTINGS } from "@/lib/types";

export default function CalculatorPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">利益計算</h1>
        <p className="text-sm muted">商品を登録せずに試算できます。値を変えると即座に再計算されます（保存はされません）。</p>
      </div>
      <section className="card">
        <ProfitCalculator initial={{ ...DEFAULT_PROFIT_SETTINGS, salePrice: 3000, purchasePrice: 1000, shippingCost: 750 }} />
      </section>
    </div>
  );
}
