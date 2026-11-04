import { expect, test, type Page } from "@playwright/test";

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function noHorizontalScroll(page: Page) {
  // モバイルエミュレーションでは innerWidth がコンテンツ幅に合わせて広がるため、設定したビューポート幅と比較する
  const viewportWidth = page.viewportSize()!.width;
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

async function loadDemo(page: Page) {
  await page.goto("/data");
  await page.getByRole("button", { name: "デモデータを読み込む" }).click();
  await expect(page.getByText(/商品 3 件（うちデモ 3）/)).toBeVisible();
}

test("デモデータ: 一覧・検索・絞り込み・相場分析・相場不明", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/");
  const list = page.getByTestId("item-list");
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("架空のものです")).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByLabel("検索").fill("スニーカー");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await page.getByLabel("検索").fill("");
  await page.getByLabel("ステータス").selectOption("sold");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("マグカップ");
  await page.getByLabel("ステータス").selectOption("all");
  await page.getByLabel("データ種別").selectOption("real");
  await expect(page.getByText("条件に一致する商品がありません")).toBeVisible();
  await page.getByLabel("データ種別").selectOption("all");

  // 売却済み7件 → 価格案あり
  await list.getByText("ナイロンジャケット").click();
  await page.getByRole("tab", { name: "相場分析" }).click();
  await expect(page.getByTestId("suggestion-quick")).toHaveText("¥3,100");
  await expect(page.getByTestId("suggestion-fair")).toHaveText("¥3,300");
  await expect(page.getByTestId("suggestion-ambitious")).toHaveText("¥3,700");
  await expect(page.getByTestId("analysis-notes")).toContainText("売却済み価格」のみから算出");
  await expect(page.getByTestId("comps-table").getByText("出品中")).toHaveCount(3);
  await noHorizontalScroll(page);

  // 期間を30日に絞ると売却済み4件 → 相場不明
  await page.getByLabel("取得日", { exact: true }).selectOption("30");
  await expect(page.getByTestId("market-unknown")).toContainText("相場不明");

  // スニーカー: 売却済み2件のみ → 相場不明
  await page.goto("/");
  await page.getByTestId("item-list").getByText("スニーカー").click();
  await page.getByRole("tab", { name: "相場分析" }).click();
  await expect(page.getByTestId("market-unknown")).toContainText("売却済みデータ 2 件");
});

test("商品登録 → 写真 → 相場入力・CSV → 利益計算 → 出品文章", async ({ page, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/items/new");
  await page.getByLabel("ブランド").fill("テストブランド");
  await page.getByLabel("商品名").fill("ウールコート");
  await page.getByLabel("サイズ").fill("L");
  await page.getByLabel("商品の状態").selectOption("slight_damage");
  await page.getByLabel("仕入れ値").fill("2000");
  await page.getByTestId("photo-input").setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: PNG },
    { name: "b.png", mimeType: "image/png", buffer: PNG },
  ]);
  await expect(page.getByAltText("写真2")).toBeVisible();
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("item-id")).toHaveText(/^[0-9a-f-]{36}$/);
  await expect(page.getByTestId("photo-grid").getByRole("listitem")).toHaveCount(2);
  await noHorizontalScroll(page);

  // 相場: 手入力1件（区分未選択はエラー）
  await page.getByRole("tab", { name: "相場分析" }).click();
  await expect(page.getByTestId("market-unknown")).toBeVisible();
  await page.getByLabel("価格（必須）").fill("5000");
  await page.getByLabel("情報源（必須）").fill("メルカリで目視確認");
  await page.getByRole("button", { name: "追加する" }).click();
  await expect(page.getByRole("form", { name: "比較対象の追加" }).getByRole("alert")).toContainText("売却済み価格");
  await page.getByLabel(/^売却済み価格/).check();
  await page.getByRole("button", { name: "追加する" }).click();
  await expect(page.getByTestId("comps-table").locator("tbody tr")).toHaveCount(1);

  // CSV で売却済み4件 + 出品1件 + 不正1件
  const csv = [
    "item_id,title,price,price_type,observed_at,source,condition,size,url,note",
    ",,4000,sold,2026-10-01,手動,,L,,",
    ",,4500,sold,2026-10-02,手動,,L,,",
    ",,5500,sold,2026-10-03,手動,,L,https://example.com/x,",
    ",,6000,売却済み,2026-10-04,手動,,L,,",
    ",,9000,listed,2026-10-04,手動,,L,,",
    ",,abc,sold,2026-10-04,手動,,L,,",
  ].join("\n");
  await page.getByTestId("csv-input").setInputFiles({ name: "c.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByTestId("comps-table").locator("tbody tr")).toHaveCount(6);
  await expect(page.getByText("7行目: 価格「abc」が正の整数ではありません")).toBeVisible();
  // 売却済み: 4000,4500,5000,5500,6000 → P25 4500 / 中央値 5000 / P75 5500
  await expect(page.getByTestId("suggestion-fair")).toHaveText("¥5,000");
  await page.getByTestId("price-suggestions").getByRole("listitem").nth(1).getByRole("button", { name: "出品価格に設定" }).click();

  // 利益計算: リアルタイム更新
  await page.getByRole("tab", { name: "利益計算" }).click();
  await expect(page.getByLabel("販売価格")).toHaveValue("5000");
  await page.getByLabel("送料").fill("750");
  await page.getByLabel("梱包費").fill("50");
  // 5000 - 500 - 750 = 3750, 3750 - 50 - 2000 = 1700
  await expect(page.getByTestId("payout")).toHaveText("¥3,750");
  await expect(page.getByTestId("net-profit")).toHaveText("¥1,700");
  await expect(page.getByTestId("break-even")).toHaveText("¥3,111"); // 費用2800円: 3111 - floor(311.1) = 2800
  await page.getByLabel("販売価格").fill("3000");
  await expect(page.getByTestId("net-profit")).toHaveText("-¥100");
  await page.getByRole("button", { name: "即売れ ¥4,500" }).click();
  await expect(page.getByTestId("net-profit")).toHaveText("¥1,250");
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: /条件を保存/ }).click();

  // 出品文章
  await page.getByRole("tab", { name: "出品文章" }).click();
  await expect(page.getByTestId("title-candidates").getByRole("listitem")).toHaveCount(3);
  await expect(page.getByTestId("missing-fields")).toContainText("型番");
  await page.getByTestId("title-candidates").getByRole("button", { name: "採用" }).first().click();
  await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue("テストブランド ウールコート L");
  await page.getByRole("button", { name: "説明文の下書きを作成" }).click();
  const desc = page.getByLabel("説明文", { exact: true });
  await expect(desc).toContainText("商品の状態：やや傷や汚れあり");
  await noHorizontalScroll(page);
  const text = await desc.inputValue();
  for (const w of ["正規品", "本物", "美品", "型番"]) expect(text).not.toContain(w);
  await page.getByRole("button", { name: "説明文をコピー" }).click();
  await expect(page.getByText("説明文をコピーしました")).toBeVisible();
  if (browserName === "chromium") {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  }
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("button", { name: "保存済み" })).toBeVisible();

  // 再読込しても保存されている（IndexedDB）
  await page.reload();
  await page.getByRole("tab", { name: "出品文章" }).click();
  await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue("テストブランド ウールコート L");
  await page.getByRole("tab", { name: "利益計算" }).click();
  await expect(page.getByLabel("販売価格")).toHaveValue("4500");
  await expect(page.getByLabel("送料")).toHaveValue("750");
});

test("定型文テンプレートの保存と説明文への差し込み", async ({ page }) => {
  await page.goto("/templates");
  await page.getByRole("button", { name: "＋ 新しいテンプレート" }).click();
  await page.getByLabel("テンプレート名").fill("発送テンプレ");
  await page.getByLabel("本文").fill("サイズ{size}用の袋で発送します。\n型番：{model}");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByTestId("template-list")).toContainText("発送テンプレ");

  await page.goto("/items/new");
  await page.getByLabel("商品名").fill("シャツ");
  await page.getByLabel("サイズ").fill("S");
  await page.getByRole("button", { name: "登録する" }).click();
  await page.getByRole("tab", { name: "出品文章" }).click();
  await page.getByLabel("定型文テンプレート").selectOption({ label: "発送テンプレ" });
  await page.getByRole("button", { name: "説明文の下書きを作成" }).click();
  const value = await page.getByLabel("説明文", { exact: true }).inputValue();
  expect(value).toContain("サイズS用の袋で発送します。");
  expect(value).not.toContain("型番");
});

test("JSONエクスポート → 全削除 → インポートで復元", async ({ page }) => {
  await loadDemo(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONをエクスポート" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const fs = await import("node:fs/promises");
  const json = JSON.parse(await fs.readFile(path!, "utf8"));
  expect(json.format).toBe("mercari-listing-os");
  expect(json.schemaVersion).toBe(1);
  expect(json.items).toHaveLength(3);
  expect(json.items.every((i: { isDemo: boolean }) => i.isDemo)).toBe(true);

  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "全データを削除" }).click();
  await expect(page.getByText(/商品 0 件/)).toBeVisible();

  await page.getByTestId("json-input").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(json)) });
  await expect(page.getByTestId("data-messages")).toContainText("インポートしました");
  await expect(page.getByText(/商品 3 件/)).toBeVisible();

  await page.getByRole("button", { name: "デモデータを削除" }).click();
  await expect(page.getByText(/商品 0 件/)).toBeVisible();
});

test("ダークモード切替と単体の利益計算ページ", async ({ page }) => {
  await page.goto("/calculator");
  const html = page.locator("html");
  await page.getByRole("button", { name: /テーマ/ }).click(); // 自動 → ライト
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: /テーマ/ }).click(); // ライト → ダーク
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  // 3000 - 300 - 750 = 1950, 1950 - 0 - 1000 = 950
  await expect(page.getByTestId("payout")).toHaveText("¥1,950");
  await expect(page.getByTestId("net-profit")).toHaveText("¥950");
  await page.getByLabel("販売手数料率（%）").fill("5");
  await expect(page.getByTestId("net-profit")).toHaveText("¥1,100");
  // 販売価格を消すと利益は表示しない（0円で計算したマイナス値を見せない）
  await page.getByLabel("販売価格").fill("");
  await expect(page.getByTestId("net-profit")).toHaveText("—");
  await expect(page.getByTestId("break-even")).toHaveText("¥1,842"); // 費用1750円・手数料5%: 1842 - floor(92.1) = 1750
  await noHorizontalScroll(page);
});
