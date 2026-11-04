"use client";

import { useState } from "react";
import { CONDITION_LABELS, CONDITIONS, ITEM_STATUSES, STATUS_LABELS, type Condition, type Item, type ItemStatus } from "@/lib/types";
import { Field, YenInput } from "./ui";

export type ItemFormValues = Pick<
  Item,
  | "brand"
  | "name"
  | "modelNumber"
  | "size"
  | "condition"
  | "conditionNote"
  | "accessories"
  | "purchasePrice"
  | "status"
  | "listingPrice"
  | "soldPrice"
  | "memo"
>;

export function pickFormValues(item: Item): ItemFormValues {
  const { brand, name, modelNumber, size, condition, conditionNote, accessories, purchasePrice, status, listingPrice, soldPrice, memo } = item;
  return { brand, name, modelNumber, size, condition, conditionNote, accessories, purchasePrice, status, listingPrice, soldPrice, memo };
}

export function ItemForm({
  initial,
  submitLabel,
  onSubmit,
  children,
}: {
  initial: ItemFormValues;
  submitLabel: string;
  onSubmit: (values: ItemFormValues) => Promise<void> | void;
  children?: React.ReactNode;
}) {
  const [v, setV] = useState<ItemFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) => setV((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.name.trim() && !v.brand.trim() && !v.modelNumber.trim()) {
      setError("ブランド・商品名・型番のいずれかを入力してください");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ ...v, brand: v.brand.trim(), name: v.name.trim(), modelNumber: v.modelNumber.trim(), size: v.size.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="商品情報">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="ブランド" htmlFor="f-brand">
          <input id="f-brand" className="input" value={v.brand} onChange={(e) => set("brand", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="商品名" htmlFor="f-name">
          <input id="f-name" className="input" value={v.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="型番" htmlFor="f-model" hint="タグや箱で確認できた場合のみ入力">
          <input id="f-model" className="input" value={v.modelNumber} onChange={(e) => set("modelNumber", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="サイズ" htmlFor="f-size">
          <input id="f-size" className="input" value={v.size} onChange={(e) => set("size", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="商品の状態" htmlFor="f-condition">
          <select id="f-condition" className="input" value={v.condition} onChange={(e) => set("condition", e.target.value as Condition)}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="仕入れ値" htmlFor="f-purchase">
          <YenInput id="f-purchase" value={v.purchasePrice} onChange={(n) => set("purchasePrice", n)} placeholder="例: 1500" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="状態の詳細" htmlFor="f-condnote" hint="傷・汚れ・使用感など、実際に確認した事実だけを書いてください。説明文に使われます。">
            <textarea id="f-condnote" className="input min-h-20" value={v.conditionNote} onChange={(e) => set("conditionNote", e.target.value)} />
          </Field>
        </div>
        <Field label="付属品" htmlFor="f-acc">
          <input id="f-acc" className="input" value={v.accessories} onChange={(e) => set("accessories", e.target.value)} placeholder="例: 箱、保証書" />
        </Field>
        <Field label="ステータス" htmlFor="f-status">
          <select id="f-status" className="input" value={v.status} onChange={(e) => set("status", e.target.value as ItemStatus)}>
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="出品価格" htmlFor="f-listing">
          <YenInput id="f-listing" value={v.listingPrice} onChange={(n) => set("listingPrice", n)} />
        </Field>
        <Field label="売却価格" htmlFor="f-sold" hint="売却済みの場合に入力">
          <YenInput id="f-sold" value={v.soldPrice} onChange={(n) => set("soldPrice", n)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="内部メモ" htmlFor="f-memo" hint="自分用のメモ。説明文には使われません。">
            <textarea id="f-memo" className="input min-h-16" value={v.memo} onChange={(e) => set("memo", e.target.value)} />
          </Field>
        </div>
      </div>
      {children}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "保存中…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
