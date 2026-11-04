import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildExport, parseImport } from "@/lib/exportFormat";
import { buildDemoData, DEMO_SOURCE } from "@/lib/demo";
import { isUuid } from "@/lib/ids";
import {
  addPhotos,
  clearAll,
  createEmptyItem,
  deleteDemoData,
  deleteItem,
  exportAll,
  getItem,
  importAll,
  listComparables,
  listItems,
  listTemplates,
  saveComparables,
  saveItem,
  saveTemplate,
} from "@/lib/db";

beforeEach(async () => {
  await clearAll();
});

describe("共通商品ID", () => {
  it("UUID v4 形式", () => {
    expect(isUuid(createEmptyItem().id)).toBe(true);
  });
});

describe("demo data", () => {
  it("すべて isDemo で、情報源は架空データと明記", () => {
    const d = buildDemoData(new Date(2026, 10, 4));
    expect(d.items.every((i) => i.isDemo)).toBe(true);
    expect(d.comparables.every((c) => c.isDemo && c.source === DEMO_SOURCE)).toBe(true);
    expect(d.templates.every((t) => t.isDemo)).toBe(true);
  });

  it("デモ削除で実データは残る", async () => {
    const d = buildDemoData();
    for (const i of d.items) await saveItem(i);
    await saveComparables(d.comparables);
    for (const t of d.templates) await saveTemplate(t);
    const real = await saveItem(createEmptyItem({ name: "実データ" }));
    expect(await deleteDemoData()).toBe(3);
    const items = await listItems();
    expect(items.map((i) => i.id)).toEqual([real.id]);
    expect(await listComparables()).toHaveLength(0);
    expect(await listTemplates()).toHaveLength(0);
  });
});

describe("JSON export / import", () => {
  it("写真込みで往復できる", async () => {
    const item = await saveItem(createEmptyItem({ brand: "B", name: "N", purchasePrice: 1200 }));
    await addPhotos(item.id, [new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })]);
    const d = buildDemoData();
    await saveComparables(d.comparables.slice(0, 2).map((c) => ({ ...c, itemId: item.id, isDemo: false })));

    const exported = buildExport(await exportAll(true));
    const json = JSON.stringify(exported);
    await clearAll();
    expect(await listItems()).toHaveLength(0);

    const parsed = parseImport(json);
    expect(parsed.warnings).toEqual([]);
    await importAll(parsed);
    const restored = await getItem(item.id);
    expect(restored).toMatchObject({ brand: "B", name: "N", purchasePrice: 1200 });
    expect(restored!.photoIds).toHaveLength(1);
    expect(await listComparables(item.id)).toHaveLength(2);
  });

  it("写真なしエクスポートを取り込んでも既存の写真参照を保持する", async () => {
    const item = await saveItem(createEmptyItem({ name: "N" }));
    await addPhotos(item.id, [new Blob([new Uint8Array([1])], { type: "image/png" })]);
    const json = JSON.stringify(buildExport(await exportAll(false)));
    await importAll(parseImport(json));
    expect((await getItem(item.id))!.photoIds).toHaveLength(1);
  });

  it("不正なファイルを拒否し、不正なレコードはスキップする", () => {
    expect(() => parseImport("not json")).toThrow("JSON");
    expect(() => parseImport('{"format":"other"}')).toThrow("エクスポートファイルではありません");
    expect(() => parseImport('{"format":"mercari-listing-os","schemaVersion":99}')).toThrow("スキーマバージョン");
    const r = parseImport(
      JSON.stringify({
        format: "mercari-listing-os",
        schemaVersion: 1,
        items: [{ id: "not-a-uuid" }, createEmptyItem({ name: "ok" })],
        comparables: [{ id: "x", itemId: "bad", price: 1, priceType: "sold", observedAt: "2026-01-01" }],
        templates: [],
      }),
    );
    expect(r.items).toHaveLength(1);
    expect(r.comparables).toHaveLength(0);
    expect(r.warnings).toHaveLength(2);
  });

  it("商品削除で関連する写真・相場データも消える", async () => {
    const item = await saveItem(createEmptyItem({ name: "N" }));
    await addPhotos(item.id, [new Blob([new Uint8Array([1])], { type: "image/png" })]);
    await saveComparables(buildDemoData().comparables.slice(0, 1).map((c) => ({ ...c, itemId: item.id })));
    await deleteItem(item.id);
    expect(await listComparables()).toHaveLength(0);
    const exported = await exportAll(true);
    expect(exported.photos).toHaveLength(0);
  });
});
