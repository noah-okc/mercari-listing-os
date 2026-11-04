/** 外部（JSONインポートなど）から来たデータを安全な型に正規化する */

import { isUuid } from "./ids";
import {
  CONDITIONS,
  DEFAULT_PROFIT_SETTINGS,
  ITEM_STATUSES,
  type Comparable,
  type Condition,
  type Item,
  type ItemStatus,
  type Template,
} from "./types";
import { normalizeYmd } from "./csv";

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const bool = (v: unknown): boolean => v === true;
const iso = (v: unknown, fallback: string): string =>
  typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : fallback;

const condition = (v: unknown): Condition =>
  (CONDITIONS as readonly unknown[]).includes(v) ? (v as Condition) : "unknown";
const status = (v: unknown): ItemStatus =>
  (ITEM_STATUSES as readonly unknown[]).includes(v) ? (v as ItemStatus) : "draft";

export function normalizeItem(raw: unknown, now: string): Item | null {
  if (!isObj(raw) || !isUuid(raw.id)) return null;
  const profit = isObj(raw.profit) ? raw.profit : {};
  return {
    id: raw.id.toLowerCase(),
    brand: str(raw.brand),
    name: str(raw.name),
    modelNumber: str(raw.modelNumber),
    size: str(raw.size),
    condition: condition(raw.condition),
    conditionNote: str(raw.conditionNote),
    accessories: str(raw.accessories),
    purchasePrice: numOrNull(raw.purchasePrice),
    status: status(raw.status),
    listingPrice: numOrNull(raw.listingPrice),
    soldPrice: numOrNull(raw.soldPrice),
    memo: str(raw.memo),
    photoIds: Array.isArray(raw.photoIds) ? raw.photoIds.filter((p): p is string => typeof p === "string") : [],
    profit: {
      feeRate: num(profit.feeRate, DEFAULT_PROFIT_SETTINGS.feeRate),
      shippingCost: num(profit.shippingCost, DEFAULT_PROFIT_SETTINGS.shippingCost),
      packagingCost: num(profit.packagingCost, DEFAULT_PROFIT_SETTINGS.packagingCost),
    },
    listingTitle: str(raw.listingTitle),
    listingDescription: str(raw.listingDescription),
    isDemo: bool(raw.isDemo),
    createdAt: iso(raw.createdAt, now),
    updatedAt: iso(raw.updatedAt, now),
  };
}

export function normalizeComparable(raw: unknown, now: string): Comparable | null {
  if (!isObj(raw) || typeof raw.id !== "string" || !isUuid(raw.itemId)) return null;
  const price = numOrNull(raw.price);
  if (price === null || price <= 0) return null;
  if (raw.priceType !== "sold" && raw.priceType !== "listed") return null;
  const observedAt = normalizeYmd(str(raw.observedAt));
  if (!observedAt) return null;
  const url = str(raw.url);
  return {
    id: raw.id,
    itemId: raw.itemId.toLowerCase(),
    title: str(raw.title),
    price,
    priceType: raw.priceType,
    observedAt,
    source: str(raw.source),
    condition: condition(raw.condition),
    size: str(raw.size),
    url: /^https?:\/\//i.test(url) ? url : "",
    note: str(raw.note),
    isDemo: bool(raw.isDemo),
    createdAt: iso(raw.createdAt, now),
  };
}

export function normalizeTemplate(raw: unknown, now: string): Template | null {
  if (!isObj(raw) || typeof raw.id !== "string" || typeof raw.body !== "string") return null;
  return {
    id: raw.id,
    name: str(raw.name, "無題のテンプレート"),
    body: raw.body,
    isDemo: bool(raw.isDemo),
    createdAt: iso(raw.createdAt, now),
    updatedAt: iso(raw.updatedAt, now),
  };
}
