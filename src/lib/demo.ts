/**
 * デモデータ。すべて架空の商品・架空の価格であり、実在の成約価格や販売実績ではない。
 * isDemo = true で保存し、画面上でも「デモ」と明示する。
 */

import { createEmptyItem } from "./db";
import { newId } from "./ids";
import type { Comparable, Condition, Item, PriceType, Template } from "./types";
import { todayYmd } from "./format";

export const DEMO_SOURCE = "デモ（架空データ）";

function daysAgo(n: number, today: Date): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return todayYmd(d);
}

export function buildDemoData(today: Date = new Date()): {
  items: Item[];
  comparables: Comparable[];
  templates: Template[];
} {
  const now = today.toISOString();
  const jacket = createEmptyItem({
    brand: "サンプルブランドA",
    name: "デモ用 ナイロンジャケット",
    modelNumber: "DEMO-JK-001",
    size: "M",
    condition: "no_noticeable_damage",
    conditionNote: "（デモ）袖口に小さな毛玉があります。",
    accessories: "（デモ）なし",
    purchasePrice: 1800,
    status: "draft",
    profit: { feeRate: 0.1, shippingCost: 750, packagingCost: 50 },
    memo: "これはデモデータです。削除は「データ管理」から行えます。",
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  });
  const sneakers = createEmptyItem({
    brand: "サンプルブランドB",
    name: "デモ用 スニーカー",
    modelNumber: "DEMO-SN-220",
    size: "26.5cm",
    condition: "slight_damage",
    conditionNote: "（デモ）つま先に擦れがあります。",
    purchasePrice: 2500,
    status: "listed",
    listingPrice: 4800,
    profit: { feeRate: 0.1, shippingCost: 850, packagingCost: 80 },
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  });
  const mug = createEmptyItem({
    brand: "",
    name: "デモ用 マグカップ",
    size: "",
    condition: "new",
    purchasePrice: 300,
    status: "sold",
    listingPrice: 1200,
    soldPrice: 1100,
    profit: { feeRate: 0.1, shippingCost: 210, packagingCost: 30 },
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  });

  const comp = (
    item: Item,
    price: number,
    priceType: PriceType,
    ago: number,
    condition: Condition,
    size: string,
  ): Comparable => ({
    id: newId(),
    itemId: item.id,
    title: `（デモ）${item.name} 比較対象`,
    price,
    priceType,
    observedAt: daysAgo(ago, today),
    source: DEMO_SOURCE,
    condition,
    size,
    url: "",
    note: "架空の価格です",
    isDemo: true,
    createdAt: now,
  });

  const comparables: Comparable[] = [
    // ジャケット: 売却済み 7件（相場算出可能）+ 出品中 3件
    comp(jacket, 3200, "sold", 5, "no_noticeable_damage", "M"),
    comp(jacket, 3500, "sold", 12, "no_noticeable_damage", "M"),
    comp(jacket, 2800, "sold", 20, "slight_damage", "M"),
    comp(jacket, 3900, "sold", 26, "like_new", "M"),
    comp(jacket, 3000, "sold", 33, "no_noticeable_damage", "L"),
    comp(jacket, 4200, "sold", 41, "like_new", "M"),
    comp(jacket, 3300, "sold", 60, "no_noticeable_damage", "M"),
    comp(jacket, 4980, "listed", 2, "no_noticeable_damage", "M"),
    comp(jacket, 4500, "listed", 3, "like_new", "M"),
    comp(jacket, 5500, "listed", 4, "no_noticeable_damage", "S"),
    // スニーカー: 売却済み 2件のみ（相場不明の例）
    comp(sneakers, 4500, "sold", 10, "slight_damage", "26.5cm"),
    comp(sneakers, 5200, "sold", 18, "no_noticeable_damage", "26.5cm"),
    comp(sneakers, 6800, "listed", 1, "slight_damage", "26.5cm"),
  ];

  const templates: Template[] = [
    {
      id: newId(),
      name: "（デモ）標準の締め",
      body: [
        "■ 発送について",
        "防水対策をして発送します。",
        "",
        "ご不明な点はコメントでお気軽にお問い合わせください。",
      ].join("\n"),
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return { items: [jacket, sneakers, mug], comparables, templates };
}
