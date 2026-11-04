import type { Item, ItemStatus } from "./types";

export type SortKey = "updated_desc" | "created_desc" | "name_asc" | "purchase_asc" | "purchase_desc" | "listing_desc";

export const SORT_LABELS: Record<SortKey, string> = {
  updated_desc: "更新日が新しい順",
  created_desc: "登録日が新しい順",
  name_asc: "商品名順",
  purchase_asc: "仕入れ値が安い順",
  purchase_desc: "仕入れ値が高い順",
  listing_desc: "出品価格が高い順",
};

export interface ItemQuery {
  text: string;
  status: ItemStatus | "all";
  dataKind: "all" | "real" | "demo";
  sort: SortKey;
}

export const DEFAULT_QUERY: ItemQuery = { text: "", status: "all", dataKind: "all", sort: "updated_desc" };

/** 全角英数を半角に、カタカナはそのまま、大文字小文字を無視して比較するための正規化 */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** null を末尾に回す数値比較 */
function cmpNullable(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * dir;
}

export function queryItems(items: readonly Item[], q: ItemQuery): Item[] {
  const terms = normalizeSearch(q.text).split(" ").filter(Boolean);
  const filtered = items.filter((item) => {
    if (q.status !== "all" && item.status !== q.status) return false;
    if (q.dataKind === "real" && item.isDemo) return false;
    if (q.dataKind === "demo" && !item.isDemo) return false;
    if (terms.length) {
      const hay = normalizeSearch([item.brand, item.name, item.modelNumber, item.size, item.memo, item.id].join(" "));
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (q.sort) {
      case "updated_desc":
        return b.updatedAt.localeCompare(a.updatedAt);
      case "created_desc":
        return b.createdAt.localeCompare(a.createdAt);
      case "name_asc":
        return `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`, "ja");
      case "purchase_asc":
        return cmpNullable(a.purchasePrice, b.purchasePrice, 1);
      case "purchase_desc":
        return cmpNullable(a.purchasePrice, b.purchasePrice, -1);
      case "listing_desc":
        return cmpNullable(a.listingPrice, b.listingPrice, -1);
    }
  });
  return sorted;
}

export function itemDisplayName(item: Pick<Item, "brand" | "name" | "modelNumber">): string {
  const parts = [item.brand, item.name].map((s) => s.trim()).filter(Boolean);
  if (parts.length) return parts.join(" ");
  return item.modelNumber.trim() || "（名称未設定）";
}
