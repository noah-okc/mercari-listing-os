/**
 * 出品文章の生成。
 *
 * 原則: 入力済みの事実だけを使い、真贋・年代・状態など未入力の情報は一切補わない。
 * 「正規品」「本物」「美品」「〇〇年製」のような断定表現は、ユーザーが自分で入力しない限り出力しない。
 */

import { CONDITION_LABELS, type Item } from "./types";

/** メルカリの商品名の最大文字数 */
export const TITLE_MAX_LENGTH = 40;
/** メルカリの商品説明の最大文字数 */
export const DESCRIPTION_MAX_LENGTH = 1000;

export type ListingSource = Pick<
  Item,
  "brand" | "name" | "modelNumber" | "size" | "condition" | "conditionNote" | "accessories"
>;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** 文字数（サロゲートペアを1文字として数える） */
export function charLength(s: string): number {
  return Array.from(s).length;
}

export function truncateChars(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max).join("");
}

function joinParts(parts: (string | false | undefined)[]): string {
  return clean(parts.filter((p): p is string => typeof p === "string" && clean(p) !== "").map(clean).join(" "));
}

/** 末尾の語を落としながら max 文字に収める（語の途中で切らない。1語でも超える場合のみ切り詰め） */
function fitTitle(parts: string[], max: number): string {
  const usable = parts.map(clean).filter(Boolean);
  for (let n = usable.length; n > 0; n--) {
    const t = usable.slice(0, n).join(" ");
    if (charLength(t) <= max) return t;
  }
  return truncateChars(usable[0] ?? "", max);
}

export function generateTitles(src: ListingSource): string[] {
  const brand = clean(src.brand);
  const name = clean(src.name);
  const model = clean(src.modelNumber);
  const size = clean(src.size);
  const cond = src.condition !== "unknown" ? CONDITION_LABELS[src.condition] : "";

  if (!brand && !name && !model) return [];

  const candidates = [
    fitTitle([brand, name, model, size], TITLE_MAX_LENGTH),
    cond
      ? fitTitle([`【${cond}】${brand || name}`, brand ? name : "", size, model], TITLE_MAX_LENGTH)
      : fitTitle([brand, name, size ? `サイズ${size}` : ""], TITLE_MAX_LENGTH),
    fitTitle([model ? `${model}` : "", brand, name, size ? `${size}サイズ` : ""], TITLE_MAX_LENGTH),
  ].map(clean);

  // 重複を除去しつつ3案に揃える
  const unique = Array.from(new Set(candidates.filter(Boolean)));
  const fallbacks = [
    fitTitle([name, brand, size], TITLE_MAX_LENGTH),
    fitTitle([brand, name], TITLE_MAX_LENGTH),
    fitTitle([name], TITLE_MAX_LENGTH),
  ];
  for (const f of fallbacks) {
    if (unique.length >= 3) break;
    if (f && !unique.includes(f)) unique.push(f);
  }
  return unique.slice(0, 3);
}

/** 説明文に使える項目のうち未入力のもの（ユーザーへの確認用） */
export function missingFields(src: ListingSource): string[] {
  const missing: string[] = [];
  if (!clean(src.brand)) missing.push("ブランド");
  if (!clean(src.name)) missing.push("商品名");
  if (!clean(src.modelNumber)) missing.push("型番");
  if (!clean(src.size)) missing.push("サイズ");
  if (src.condition === "unknown") missing.push("商品の状態");
  if (!clean(src.conditionNote)) missing.push("状態の詳細");
  if (!clean(src.accessories)) missing.push("付属品");
  return missing;
}

/** テンプレートで使えるプレースホルダ */
export const TEMPLATE_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "{brand}", label: "ブランド" },
  { key: "{name}", label: "商品名" },
  { key: "{model}", label: "型番" },
  { key: "{size}", label: "サイズ" },
  { key: "{condition}", label: "商品の状態" },
  { key: "{condition_note}", label: "状態の詳細" },
  { key: "{accessories}", label: "付属品" },
];

/**
 * テンプレートのプレースホルダを置換する。未入力の値を含む行は丸ごと削除する
 * （空欄のまま「型番：」のような行を残したり、推測で埋めたりしないため）。
 */
export function applyTemplate(template: string, src: ListingSource): string {
  const values: Record<string, string> = {
    "{brand}": clean(src.brand),
    "{name}": clean(src.name),
    "{model}": clean(src.modelNumber),
    "{size}": clean(src.size),
    "{condition}": src.condition !== "unknown" ? CONDITION_LABELS[src.condition] : "",
    "{condition_note}": src.conditionNote.trim(),
    "{accessories}": clean(src.accessories),
  };
  const lines = template.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const keys = line.match(/\{[a-z_]+\}/g) ?? [];
    const known = keys.filter((k) => k in values);
    if (known.some((k) => values[k] === "")) continue;
    out.push(line.replace(/\{[a-z_]+\}/g, (k) => (k in values ? values[k] : k)));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function generateDescription(src: ListingSource, templateBody?: string): string {
  const lines: string[] = [];
  const title = joinParts([src.brand, src.name]);
  if (title) lines.push(`${title} です。`, "");

  const spec: string[] = [];
  if (clean(src.brand)) spec.push(`ブランド：${clean(src.brand)}`);
  if (clean(src.name)) spec.push(`商品名：${clean(src.name)}`);
  if (clean(src.modelNumber)) spec.push(`型番：${clean(src.modelNumber)}`);
  if (clean(src.size)) spec.push(`サイズ：${clean(src.size)}`);
  if (spec.length) lines.push("■ 商品情報", ...spec, "");

  const stateLines: string[] = [];
  if (src.condition !== "unknown") stateLines.push(`商品の状態：${CONDITION_LABELS[src.condition]}`);
  if (src.conditionNote.trim()) stateLines.push(src.conditionNote.trim());
  if (stateLines.length) lines.push("■ 状態", ...stateLines, "");

  if (clean(src.accessories)) lines.push("■ 付属品", clean(src.accessories), "");

  if (templateBody && templateBody.trim()) {
    const applied = applyTemplate(templateBody, src);
    if (applied) lines.push(applied, "");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
