/**
 * Mercari Listing OS のデータモデル。
 * `Item.id` は他ツール（Buy or Pass など）と共有する共通商品ID（UUID v4）。
 */

export const SCHEMA_VERSION = 1 as const;

export type ItemStatus = "draft" | "listed" | "sold";

export const ITEM_STATUSES: readonly ItemStatus[] = ["draft", "listed", "sold"];

export const STATUS_LABELS: Record<ItemStatus, string> = {
  draft: "下書き",
  listed: "出品中",
  sold: "売却済み",
};

/** メルカリの商品の状態区分に準拠 */
export type Condition =
  | "new"
  | "like_new"
  | "no_noticeable_damage"
  | "slight_damage"
  | "damage"
  | "poor"
  | "unknown";

export const CONDITIONS: readonly Condition[] = [
  "new",
  "like_new",
  "no_noticeable_damage",
  "slight_damage",
  "damage",
  "poor",
  "unknown",
];

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "新品、未使用",
  like_new: "未使用に近い",
  no_noticeable_damage: "目立った傷や汚れなし",
  slight_damage: "やや傷や汚れあり",
  damage: "傷や汚れあり",
  poor: "全体的に状態が悪い",
  unknown: "未設定",
};

export interface ProfitSettings {
  /** 販売手数料率（0.1 = 10%） */
  feeRate: number;
  /** 送料（円） */
  shippingCost: number;
  /** 梱包費（円） */
  packagingCost: number;
}

export const DEFAULT_PROFIT_SETTINGS: ProfitSettings = {
  feeRate: 0.1,
  shippingCost: 0,
  packagingCost: 0,
};

export interface Item {
  /** 共通商品ID（UUID v4）。Buy or Pass 等との連携キー */
  id: string;
  brand: string;
  name: string;
  modelNumber: string;
  size: string;
  condition: Condition;
  /** 状態の詳細（傷・汚れなど、本人が確認した事実のみ） */
  conditionNote: string;
  /** 付属品 */
  accessories: string;
  /** 仕入れ値（円）。未入力は null */
  purchasePrice: number | null;
  status: ItemStatus;
  /** 出品価格（円）。未設定は null */
  listingPrice: number | null;
  /** 売却価格（円）。未設定は null */
  soldPrice: number | null;
  /** 内部メモ（説明文には使わない） */
  memo: string;
  /** 写真ID（並び順 = 表示順、先頭がカバー） */
  photoIds: string[];
  profit: ProfitSettings;
  /** 出品タイトル・説明文（保存済みの最終稿） */
  listingTitle: string;
  listingDescription: string;
  /** デモデータなら true。実データと区別するため */
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  itemId: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
}

/** 比較対象の価格区分。出品価格と売却済み価格は必ず区別する */
export type PriceType = "sold" | "listed";

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  sold: "売却済み価格",
  listed: "出品価格",
};

export interface Comparable {
  id: string;
  /** 紐づく商品の共通商品ID */
  itemId: string;
  title: string;
  price: number;
  priceType: PriceType;
  /** 取得日 YYYY-MM-DD */
  observedAt: string;
  /** 情報源（例: 「メルカリ 手動確認」「店頭」など） */
  source: string;
  condition: Condition;
  size: string;
  url: string;
  note: string;
  isDemo: boolean;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  body: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}
