/**
 * 相場データ（比較対象）の CSV 入出力。RFC 4180 準拠のクォート処理、UTF-8 BOM 対応。
 *
 * 列: item_id,title,price,price_type,observed_at,source,condition,size,url,note
 *  - price_type: sold / listed（「売却済み」「出品中」等の日本語も可）
 *  - condition : new 等のキー、またはメルカリの状態ラベル（「目立った傷や汚れなし」等）
 *  - item_id   : 空欄なら取込時に指定した商品へ紐づけ
 */

import { newId } from "./ids";
import { CONDITION_LABELS, CONDITIONS, type Comparable, type Condition, type PriceType } from "./types";
import { parseYenInput } from "./format";

export const COMPARABLE_CSV_COLUMNS = [
  "item_id",
  "title",
  "price",
  "price_type",
  "observed_at",
  "source",
  "condition",
  "size",
  "url",
  "note",
] as const;

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function escapeCell(value: string): string {
  // 先頭が = + - @ のセルは表計算ソフトで数式として解釈されうるため ' を前置
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

export function comparablesToCsv(comps: readonly Comparable[]): string {
  const rows = comps.map((c) => [
    c.itemId,
    c.title,
    String(c.price),
    c.priceType,
    c.observedAt,
    c.source,
    c.condition,
    c.size,
    c.url,
    c.note,
  ]);
  return "﻿" + toCsv([[...COMPARABLE_CSV_COLUMNS], ...rows]);
}

export function parsePriceType(raw: string): PriceType | null {
  const v = raw.trim().toLowerCase();
  if (["sold", "売却済み", "売却済", "売り切れ", "sold_out", "成約"].includes(v)) return "sold";
  if (["listed", "出品中", "出品価格", "on_sale", "販売中"].includes(v)) return "listed";
  return null;
}

export function parseCondition(raw: string): Condition {
  const v = raw.trim();
  if ((CONDITIONS as readonly string[]).includes(v)) return v as Condition;
  const found = CONDITIONS.find((c) => CONDITION_LABELS[c] === v);
  return found ?? "unknown";
}

const YMD_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;

export function normalizeYmd(raw: string): string | null {
  const m = YMD_RE.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface CsvImportResult {
  comparables: Comparable[];
  errors: { line: number; message: string }[];
}

export function comparablesFromCsv(
  text: string,
  options: { defaultItemId?: string; isDemo?: boolean; now?: Date } = {},
): CsvImportResult {
  const rows = parseCsv(text);
  const errors: CsvImportResult["errors"] = [];
  if (rows.length === 0) return { comparables: [], errors: [{ line: 1, message: "CSVが空です" }] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  for (const required of ["price", "price_type", "observed_at", "source"]) {
    if (idx(required) < 0) {
      errors.push({ line: 1, message: `必須列「${required}」がヘッダーにありません` });
    }
  }
  if (errors.length > 0) return { comparables: [], errors };

  const createdAt = (options.now ?? new Date()).toISOString();
  const comparables: Comparable[] = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (name: string) => {
      const j = idx(name);
      const v = j >= 0 ? (r[j] ?? "").trim() : "";
      // エクスポート時に数式対策で付けた ' を外す
      return /^'[=+\-@]/.test(v) ? v.slice(1) : v;
    };
    const price = parseYenInput(get("price"));
    if (price === null || price <= 0 || !Number.isInteger(price)) {
      errors.push({ line, message: `価格「${get("price")}」が正の整数ではありません` });
      return;
    }
    const priceType = parsePriceType(get("price_type"));
    if (!priceType) {
      errors.push({ line, message: `price_type「${get("price_type")}」は sold か listed を指定してください` });
      return;
    }
    const observedAt = normalizeYmd(get("observed_at"));
    if (!observedAt) {
      errors.push({ line, message: `取得日「${get("observed_at")}」は YYYY-MM-DD 形式で指定してください` });
      return;
    }
    const source = get("source");
    if (!source) {
      errors.push({ line, message: "情報源（source）が空です" });
      return;
    }
    const itemId = get("item_id") || options.defaultItemId || "";
    if (!itemId) {
      errors.push({ line, message: "item_id が空で、取込先の商品も指定されていません" });
      return;
    }
    const url = get("url");
    if (url && !/^https?:\/\//i.test(url)) {
      errors.push({ line, message: `URL「${url}」は http(s):// で始めてください` });
      return;
    }
    comparables.push({
      id: newId(),
      itemId,
      title: get("title"),
      price,
      priceType,
      observedAt,
      source,
      condition: parseCondition(get("condition")),
      size: get("size"),
      url,
      note: get("note"),
      isDemo: options.isDemo ?? false,
      createdAt,
    });
  });
  return { comparables, errors };
}
