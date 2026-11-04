import { describe, expect, it } from "vitest";
import { comparablesFromCsv, comparablesToCsv, normalizeYmd, parseCsv, parsePriceType, toCsv } from "@/lib/csv";

const ITEM = "22222222-2222-4222-8222-222222222222";

describe("parseCsv", () => {
  it("クォート・改行・BOM・CRLF を扱う", () => {
    const rows = parseCsv('﻿a,b,c\r\n"x,1","he said ""hi""","line1\nline2"\r\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x,1", 'he said "hi"', "line1\nline2"],
    ]);
  });
  it("空行を無視する", () => {
    expect(parseCsv("a\n\nb\n")).toEqual([["a"], ["b"]]);
  });
});

describe("toCsv", () => {
  it("数式インジェクション対策で先頭記号をエスケープする", () => {
    expect(toCsv([["=SUM(A1)", "-100", "@x"]])).toBe("'=SUM(A1),-100,'@x\r\n");
  });
});

describe("helpers", () => {
  it("価格区分の日本語表記を受け付ける", () => {
    expect(parsePriceType("売却済み")).toBe("sold");
    expect(parsePriceType("出品中")).toBe("listed");
    expect(parsePriceType("SOLD")).toBe("sold");
    expect(parsePriceType("不明")).toBeNull();
  });
  it("日付を正規化し、存在しない日付を拒否する", () => {
    expect(normalizeYmd("2026/1/5")).toBe("2026-01-05");
    expect(normalizeYmd("2026-02-30")).toBeNull();
    expect(normalizeYmd("昨日")).toBeNull();
  });
});

describe("comparablesFromCsv", () => {
  const header = "item_id,title,price,price_type,observed_at,source,condition,size,url,note";

  it("正常行を取り込み、不正行は行番号付きでエラーにする", () => {
    const csv = [
      header,
      `,ジャケット,"3,200",sold,2026-10-01,メルカリ 手動確認,目立った傷や汚れなし,M,https://example.com/a,`,
      `,ジャケット,4500,出品中,2026/10/02,店頭,like_new,M,,`,
      `,価格なし,,sold,2026-10-01,手動,,,,`,
      `,区分なし,3000,unknown,2026-10-01,手動,,,,`,
      `,日付不正,3000,sold,2026-13-01,手動,,,,`,
      `,情報源なし,3000,sold,2026-10-01,,,,,`,
      `,URL不正,3000,sold,2026-10-01,手動,,,javascript:alert(1),`,
    ].join("\n");
    const r = comparablesFromCsv(csv, { defaultItemId: ITEM });
    expect(r.comparables).toHaveLength(2);
    expect(r.comparables[0]).toMatchObject({ itemId: ITEM, price: 3200, priceType: "sold", condition: "no_noticeable_damage", isDemo: false });
    expect(r.comparables[1]).toMatchObject({ price: 4500, priceType: "listed", observedAt: "2026-10-02", condition: "like_new" });
    expect(r.errors.map((e) => e.line)).toEqual([4, 5, 6, 7, 8]);
  });

  it("必須列がなければヘッダーエラー", () => {
    const r = comparablesFromCsv("title,price\nx,100");
    expect(r.comparables).toHaveLength(0);
    expect(r.errors[0].message).toContain("price_type");
  });

  it("エクスポート→インポートで内容が保たれる", () => {
    const original = comparablesFromCsv(
      [header, `${ITEM},"タイトル, ""引用""",3000,sold,2026-10-01,手動,slight_damage,L,https://example.com,-傷あり`].join("\n"),
    ).comparables;
    const round = comparablesFromCsv(comparablesToCsv(original)).comparables;
    expect(round).toHaveLength(1);
    const { id: _a, createdAt: _b, ...x } = original[0];
    const { id: _c, createdAt: _d, ...y } = round[0];
    expect(y).toEqual(x);
  });
});
