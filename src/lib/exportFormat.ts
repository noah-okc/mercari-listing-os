/**
 * JSON エクスポート／インポートの形式。
 *
 * {
 *   "format": "mercari-listing-os",
 *   "schemaVersion": 1,
 *   "exportedAt": "2026-01-01T00:00:00.000Z",
 *   "items": Item[],
 *   "comparables": Comparable[],
 *   "templates": Template[],
 *   "photos": { "id", "itemId", "mimeType", "createdAt", "dataUrl" }[]   // 任意
 * }
 */

import { normalizeComparable, normalizeItem, normalizeTemplate } from "./normalize";
import { SCHEMA_VERSION, type Comparable, type Item, type Template } from "./types";

export const EXPORT_FORMAT = "mercari-listing-os";

export interface ExportedPhoto {
  id: string;
  itemId: string;
  mimeType: string;
  createdAt: string;
  dataUrl: string;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  items: Item[];
  comparables: Comparable[];
  templates: Template[];
  photos?: ExportedPhoto[];
}

export interface ParsedImport {
  items: Item[];
  comparables: Comparable[];
  templates: Template[];
  photos: ExportedPhoto[];
  warnings: string[];
}

export function buildExport(data: {
  items: Item[];
  comparables: Comparable[];
  templates: Template[];
  photos?: ExportedPhoto[];
  now?: Date;
}): ExportFile {
  return {
    format: EXPORT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: (data.now ?? new Date()).toISOString(),
    items: data.items,
    comparables: data.comparables,
    templates: data.templates,
    ...(data.photos ? { photos: data.photos } : {}),
  };
}

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,[A-Za-z0-9+/=]+$/i;

export function parseImport(text: string, now: Date = new Date()): ParsedImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("JSONとして読み込めませんでした");
  }
  if (typeof raw !== "object" || raw === null || (raw as { format?: unknown }).format !== EXPORT_FORMAT) {
    throw new Error("Mercari Listing OS のエクスポートファイルではありません");
  }
  const file = raw as Record<string, unknown>;
  const version = file.schemaVersion;
  if (typeof version !== "number" || version > SCHEMA_VERSION) {
    throw new Error(`未対応のスキーマバージョンです（${String(version)}）`);
  }
  const nowIso = now.toISOString();
  const warnings: string[] = [];
  const list = (v: unknown) => (Array.isArray(v) ? v : []);

  const collect = <T>(rawList: unknown[], fn: (r: unknown, n: string) => T | null, label: string): T[] => {
    const out: T[] = [];
    let skipped = 0;
    for (const r of rawList) {
      const v = fn(r, nowIso);
      if (v) out.push(v);
      else skipped++;
    }
    if (skipped) warnings.push(`${label} ${skipped} 件は形式が不正なためスキップしました`);
    return out;
  };

  const items = collect(list(file.items), normalizeItem, "商品");
  const comparables = collect(list(file.comparables), normalizeComparable, "相場データ");
  const templates = collect(list(file.templates), normalizeTemplate, "テンプレート");
  const photos = collect(
    list(file.photos),
    (r) => {
      if (typeof r !== "object" || r === null) return null;
      const p = r as Record<string, unknown>;
      if (typeof p.id !== "string" || typeof p.itemId !== "string" || typeof p.dataUrl !== "string") return null;
      if (!DATA_URL_RE.test(p.dataUrl)) return null;
      return {
        id: p.id,
        itemId: p.itemId.toLowerCase(),
        mimeType: typeof p.mimeType === "string" ? p.mimeType : "image/jpeg",
        createdAt: typeof p.createdAt === "string" ? p.createdAt : nowIso,
        dataUrl: p.dataUrl,
      } satisfies ExportedPhoto;
    },
    "写真",
  );
  return { items, comparables, templates, photos, warnings };
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",", 2);
  const mime = /^data:([^;]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
