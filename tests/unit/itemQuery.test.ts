import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY, queryItems } from "@/lib/itemQuery";
import { createEmptyItem } from "@/lib/db";

const a = createEmptyItem({ brand: "ＡＢＣ", name: "ジャケット", status: "draft", purchasePrice: 1000, updatedAt: "2026-01-03T00:00:00Z", createdAt: "2026-01-01T00:00:00Z" });
const b = createEmptyItem({ brand: "XYZ", name: "スニーカー", modelNumber: "SN-1", status: "listed", purchasePrice: null, listingPrice: 5000, updatedAt: "2026-01-01T00:00:00Z", createdAt: "2026-01-02T00:00:00Z" });
const c = createEmptyItem({ brand: "abc", name: "マグ", status: "sold", purchasePrice: 300, isDemo: true, updatedAt: "2026-01-02T00:00:00Z", createdAt: "2026-01-03T00:00:00Z" });
const all = [a, b, c];

describe("queryItems", () => {
  it("全角・大小文字を無視して検索する", () => {
    expect(queryItems(all, { ...DEFAULT_QUERY, text: "abc" }).map((i) => i.id)).toEqual([a.id, c.id]);
    expect(queryItems(all, { ...DEFAULT_QUERY, text: "sn-1" }).map((i) => i.id)).toEqual([b.id]);
  });
  it("ステータスとデータ種別で絞り込む", () => {
    expect(queryItems(all, { ...DEFAULT_QUERY, status: "listed" })).toEqual([b]);
    expect(queryItems(all, { ...DEFAULT_QUERY, dataKind: "demo" })).toEqual([c]);
    expect(queryItems(all, { ...DEFAULT_QUERY, dataKind: "real" })).toHaveLength(2);
  });
  it("並べ替え（未入力は末尾）", () => {
    expect(queryItems(all, { ...DEFAULT_QUERY, sort: "updated_desc" }).map((i) => i.id)).toEqual([a.id, c.id, b.id]);
    expect(queryItems(all, { ...DEFAULT_QUERY, sort: "created_desc" }).map((i) => i.id)).toEqual([c.id, b.id, a.id]);
    expect(queryItems(all, { ...DEFAULT_QUERY, sort: "purchase_asc" }).map((i) => i.id)).toEqual([c.id, a.id, b.id]);
    expect(queryItems(all, { ...DEFAULT_QUERY, sort: "purchase_desc" }).map((i) => i.id)).toEqual([a.id, c.id, b.id]);
  });
});
