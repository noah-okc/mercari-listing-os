import { describe, expect, it } from "vitest";
import { applyTemplate, charLength, generateDescription, generateTitles, missingFields, TITLE_MAX_LENGTH, type ListingSource } from "@/lib/listing";

const base: ListingSource = {
  brand: "サンプル",
  name: "ナイロンジャケット",
  modelNumber: "AB-123",
  size: "M",
  condition: "no_noticeable_damage",
  conditionNote: "",
  accessories: "",
};

const FABRICATED = ["正規品", "本物", "美品", "年製", "ヴィンテージ", "希少", "新品同様", "未使用"];

describe("generateTitles", () => {
  it("3案を生成し、すべて40文字以内", () => {
    const t = generateTitles(base);
    expect(t).toHaveLength(3);
    expect(new Set(t).size).toBe(3);
    for (const x of t) expect(charLength(x)).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
  });
  it("長い商品名でも40文字以内に収める", () => {
    const t = generateTitles({ ...base, name: "とても長い商品名".repeat(10) });
    for (const x of t) expect(charLength(x)).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
  });
  it("入力に無い真贋・年代・状態の語を加えない", () => {
    const t = generateTitles({ ...base, condition: "unknown" }).join(" ");
    for (const w of FABRICATED) expect(t).not.toContain(w);
  });
  it("名称情報が無ければ候補を出さない", () => {
    expect(generateTitles({ ...base, brand: "", name: "", modelNumber: "" })).toEqual([]);
  });
});

describe("generateDescription", () => {
  it("入力済み情報のみ記載し、未入力項目の行を作らない", () => {
    const d = generateDescription({ ...base, modelNumber: "", size: "", condition: "unknown" });
    expect(d).toContain("ブランド：サンプル");
    expect(d).not.toContain("型番");
    expect(d).not.toContain("サイズ");
    expect(d).not.toContain("商品の状態");
    for (const w of FABRICATED) expect(d).not.toContain(w);
  });
  it("状態の詳細と付属品をそのまま使う", () => {
    const d = generateDescription({ ...base, conditionNote: "袖に毛玉あり", accessories: "箱" });
    expect(d).toContain("商品の状態：目立った傷や汚れなし");
    expect(d).toContain("袖に毛玉あり");
    expect(d).toContain("■ 付属品\n箱");
  });
  it("テンプレートを末尾に差し込む", () => {
    const d = generateDescription(base, "発送は{size}サイズ用の袋で行います");
    expect(d.endsWith("発送はMサイズ用の袋で行います")).toBe(true);
  });
});

describe("applyTemplate", () => {
  it("未入力のプレースホルダを含む行は削除する", () => {
    const out = applyTemplate("ブランド：{brand}\n型番：{model}\n付属品：{accessories}\n以上", { ...base, modelNumber: "" });
    expect(out).toBe("ブランド：サンプル\n以上");
  });
  it("未知のプレースホルダはそのまま残す", () => {
    expect(applyTemplate("{unknown}", base)).toBe("{unknown}");
  });
});

describe("missingFields", () => {
  it("未入力項目を列挙する", () => {
    expect(missingFields({ ...base, modelNumber: "", condition: "unknown" })).toEqual(["型番", "商品の状態", "状態の詳細", "付属品"]);
  });
});
