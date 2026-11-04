/**
 * IndexedDB 永続化層（ブラウザ内にのみ保存。サーバー送信なし）。
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { newId } from "./ids";
import {
  DEFAULT_PROFIT_SETTINGS,
  type Comparable,
  type Item,
  type Photo,
  type Template,
} from "./types";
import { blobToDataUrl, dataUrlToBlob, type ExportedPhoto, type ParsedImport } from "./exportFormat";

export const DB_NAME = "mercari-listing-os";
export const DB_VERSION = 1;

interface ListingDB extends DBSchema {
  items: { key: string; value: Item; indexes: { updatedAt: string } };
  photos: { key: string; value: Photo; indexes: { itemId: string } };
  comparables: { key: string; value: Comparable; indexes: { itemId: string } };
  templates: { key: string; value: Template };
}

let dbPromise: Promise<IDBPDatabase<ListingDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<ListingDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ListingDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const items = db.createObjectStore("items", { keyPath: "id" });
        items.createIndex("updatedAt", "updatedAt");
        const photos = db.createObjectStore("photos", { keyPath: "id" });
        photos.createIndex("itemId", "itemId");
        const comps = db.createObjectStore("comparables", { keyPath: "id" });
        comps.createIndex("itemId", "itemId");
        db.createObjectStore("templates", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

/** テスト用: 接続を破棄する */
export function resetDbConnection(): void {
  dbPromise = null;
}

// ---- 変更通知 ----
type Listener = () => void;
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(DB_NAME);
    channel.onmessage = () => listeners.forEach((l) => l());
  }
  return channel;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  getChannel();
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((l) => l());
  getChannel()?.postMessage("changed");
}

// ---- 商品 ----
export function createEmptyItem(overrides: Partial<Item> = {}): Item {
  const now = new Date().toISOString();
  return {
    id: newId(),
    brand: "",
    name: "",
    modelNumber: "",
    size: "",
    condition: "unknown",
    conditionNote: "",
    accessories: "",
    purchasePrice: null,
    status: "draft",
    listingPrice: null,
    soldPrice: null,
    memo: "",
    photoIds: [],
    profit: { ...DEFAULT_PROFIT_SETTINGS },
    listingTitle: "",
    listingDescription: "",
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export async function listItems(): Promise<Item[]> {
  return (await getDb()).getAll("items");
}

export async function getItem(id: string): Promise<Item | undefined> {
  return (await getDb()).get("items", id);
}

export async function saveItem(item: Item): Promise<Item> {
  const saved = { ...item, updatedAt: new Date().toISOString() };
  await (await getDb()).put("items", saved);
  notify();
  return saved;
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["items", "photos", "comparables"], "readwrite");
  await tx.objectStore("items").delete(id);
  for (const key of await tx.objectStore("photos").index("itemId").getAllKeys(id)) {
    await tx.objectStore("photos").delete(key);
  }
  for (const key of await tx.objectStore("comparables").index("itemId").getAllKeys(id)) {
    await tx.objectStore("comparables").delete(key);
  }
  await tx.done;
  notify();
}

// ---- 写真 ----
export async function addPhotos(itemId: string, blobs: Blob[]): Promise<Photo[]> {
  const db = await getDb();
  const tx = db.transaction(["items", "photos"], "readwrite");
  const item = await tx.objectStore("items").get(itemId);
  if (!item) throw new Error("商品が見つかりません");
  const now = new Date().toISOString();
  const photos: Photo[] = blobs.map((blob) => ({
    id: newId(),
    itemId,
    blob,
    mimeType: blob.type || "image/jpeg",
    createdAt: now,
  }));
  for (const p of photos) await tx.objectStore("photos").put(p);
  await tx.objectStore("items").put({
    ...item,
    photoIds: [...item.photoIds, ...photos.map((p) => p.id)],
    updatedAt: now,
  });
  await tx.done;
  notify();
  return photos;
}

export async function getPhotos(itemId: string): Promise<Photo[]> {
  return (await getDb()).getAllFromIndex("photos", "itemId", itemId);
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  return (await getDb()).get("photos", id);
}

export async function deletePhoto(itemId: string, photoId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["items", "photos"], "readwrite");
  await tx.objectStore("photos").delete(photoId);
  const item = await tx.objectStore("items").get(itemId);
  if (item) {
    await tx.objectStore("items").put({
      ...item,
      photoIds: item.photoIds.filter((p) => p !== photoId),
      updatedAt: new Date().toISOString(),
    });
  }
  await tx.done;
  notify();
}

// ---- 相場データ ----
export async function listComparables(itemId?: string): Promise<Comparable[]> {
  const db = await getDb();
  return itemId ? db.getAllFromIndex("comparables", "itemId", itemId) : db.getAll("comparables");
}

export async function saveComparables(comps: Comparable[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("comparables", "readwrite");
  for (const c of comps) await tx.store.put(c);
  await tx.done;
  notify();
}

export async function deleteComparable(id: string): Promise<void> {
  await (await getDb()).delete("comparables", id);
  notify();
}

// ---- テンプレート ----
export async function listTemplates(): Promise<Template[]> {
  return (await getDb()).getAll("templates");
}

export async function saveTemplate(t: Template): Promise<void> {
  await (await getDb()).put("templates", { ...t, updatedAt: new Date().toISOString() });
  notify();
}

export async function deleteTemplate(id: string): Promise<void> {
  await (await getDb()).delete("templates", id);
  notify();
}

// ---- 一括操作 ----
export async function exportAll(includePhotos: boolean) {
  const db = await getDb();
  const [items, comparables, templates] = await Promise.all([
    db.getAll("items"),
    db.getAll("comparables"),
    db.getAll("templates"),
  ]);
  let photos: ExportedPhoto[] | undefined;
  if (includePhotos) {
    const all = await db.getAll("photos");
    photos = await Promise.all(
      all.map(async (p) => ({
        id: p.id,
        itemId: p.itemId,
        mimeType: p.mimeType,
        createdAt: p.createdAt,
        dataUrl: await blobToDataUrl(p.blob),
      })),
    );
  }
  return { items, comparables, templates, photos };
}

/** インポート: 同じIDは上書き、それ以外は追加（マージ） */
export async function importAll(data: ParsedImport): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["items", "photos", "comparables", "templates"], "readwrite");
  const importedPhotoIds = new Set(data.photos.map((p) => p.id));
  const photoStore = tx.objectStore("photos");
  for (const item of data.items) {
    const existing = await tx.objectStore("items").get(item.id);
    // 参照先の写真が同梱データにも既存DBにも無いIDは除外。写真なしでインポートした場合は既存写真を保持
    const candidates = Array.from(new Set([...item.photoIds, ...(existing?.photoIds ?? [])]));
    const available: string[] = [];
    for (const id of candidates) {
      if (importedPhotoIds.has(id) || (await photoStore.getKey(id)) !== undefined) available.push(id);
    }
    await tx.objectStore("items").put({ ...item, photoIds: available });
  }
  for (const p of data.photos) {
    await tx.objectStore("photos").put({
      id: p.id,
      itemId: p.itemId,
      mimeType: p.mimeType,
      createdAt: p.createdAt,
      blob: dataUrlToBlob(p.dataUrl),
    });
  }
  for (const c of data.comparables) await tx.objectStore("comparables").put(c);
  for (const t of data.templates) await tx.objectStore("templates").put(t);
  await tx.done;
  notify();
}

/** デモデータ（isDemo = true）だけを削除 */
export async function deleteDemoData(): Promise<number> {
  const db = await getDb();
  const tx = db.transaction(["items", "photos", "comparables", "templates"], "readwrite");
  let count = 0;
  const demoItemIds = new Set<string>();
  for (const item of await tx.objectStore("items").getAll()) {
    if (item.isDemo) {
      demoItemIds.add(item.id);
      await tx.objectStore("items").delete(item.id);
      count++;
    }
  }
  for (const p of await tx.objectStore("photos").getAll()) {
    if (demoItemIds.has(p.itemId)) await tx.objectStore("photos").delete(p.id);
  }
  for (const c of await tx.objectStore("comparables").getAll()) {
    if (c.isDemo || demoItemIds.has(c.itemId)) await tx.objectStore("comparables").delete(c.id);
  }
  for (const t of await tx.objectStore("templates").getAll()) {
    if (t.isDemo) await tx.objectStore("templates").delete(t.id);
  }
  await tx.done;
  notify();
  return count;
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["items", "photos", "comparables", "templates"], "readwrite");
  await Promise.all([
    tx.objectStore("items").clear(),
    tx.objectStore("photos").clear(),
    tx.objectStore("comparables").clear(),
    tx.objectStore("templates").clear(),
    tx.done,
  ]);
  notify();
}
