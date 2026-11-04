"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { deleteItem, getItem, saveItem } from "@/lib/db";
import { useLive } from "@/lib/useLive";
import { itemDisplayName } from "@/lib/itemQuery";
import { copyText } from "@/lib/image";
import { formatDate } from "@/lib/format";
import { ITEM_STATUSES, STATUS_LABELS, type Item, type ItemStatus } from "@/lib/types";
import { ItemForm, pickFormValues } from "@/components/ItemForm";
import { PhotoManager } from "@/components/PhotoManager";
import { MarketPanel, useMarketAnalysis } from "@/components/MarketPanel";
import { ProfitCalculator } from "@/components/ProfitCalculator";
import { ListingTextPanel } from "@/components/ListingTextPanel";
import { DemoBadge, StatusBadge } from "@/components/ui";
import { toast } from "@/components/Toast";

const TABS = [
  { key: "basic", label: "基本情報" },
  { key: "market", label: "相場分析" },
  { key: "profit", label: "利益計算" },
  { key: "listing", label: "出品文章" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const router = useRouter();
  const { data: item, loading } = useLive(() => getItem(id), [id]);
  const [tab, setTab] = useState<TabKey>("basic");

  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (TABS.some((t) => t.key === h)) setTab(h as TabKey);
  }, []);
  const selectTab = (t: TabKey) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  if (loading && !item) return <p className="muted">読み込み中…</p>;
  if (!item) {
    return (
      <div className="space-y-3">
        <p>商品が見つかりませんでした。</p>
        <Link href="/" className="btn">
          商品一覧へ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm muted">
        <Link href="/" className="hover:underline">
          商品一覧
        </Link>
        <span>/</span>
        <span className="truncate">{itemDisplayName(item)}</span>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            {item.isDemo && <DemoBadge />}
          </div>
          <h1 className="mt-1 text-xl font-bold break-words">{itemDisplayName(item)}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs muted">
            <span>
              共通商品ID: <code className="font-mono" data-testid="item-id">{item.id}</code>
            </span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={async () => toast((await copyText(item.id)) ? "IDをコピーしました" : "コピーできませんでした")}
            >
              IDをコピー
            </button>
            <span>更新: {formatDate(item.updatedAt)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="quick-status">
            ステータス変更
          </label>
          <select
            id="quick-status"
            className="input w-auto"
            value={item.status}
            onChange={async (e) => {
              await saveItem({ ...item, status: e.target.value as ItemStatus });
              toast(`ステータスを「${STATUS_LABELS[e.target.value as ItemStatus]}」にしました`);
            }}
          >
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              if (!confirm("この商品と写真・相場データを削除します。よろしいですか？")) return;
              await deleteItem(item.id);
              toast("削除しました");
              router.push("/");
            }}
          >
            削除
          </button>
        </div>
      </header>

      <div role="tablist" aria-label="商品の機能" className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => selectTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
              tab === t.key ? "border-brand-600 text-brand-600 dark:text-brand-500" : "border-transparent muted hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "basic" && (
          <div className="space-y-4">
            <PhotoManager item={item} />
            <div className="card">
              <ItemForm
                key={item.id}
                initial={pickFormValues(item)}
                submitLabel="保存する"
                onSubmit={async (values) => {
                  const latest = (await getItem(item.id)) ?? item;
                  await saveItem({ ...latest, ...values });
                  toast("保存しました");
                }}
              />
            </div>
          </div>
        )}
        {tab === "market" && <MarketPanel item={item} />}
        {tab === "profit" && <ProfitTab item={item} />}
        {tab === "listing" && <ListingTextPanel key={item.id} item={item} />}
      </div>
    </div>
  );
}

function ProfitTab({ item }: { item: Item }) {
  const filter = useMemo(() => ({ withinDays: null, condition: null }), []);
  const { analysis } = useMarketAnalysis(item, filter);
  const isSold = item.status === "sold";
  const initialPrice = isSold ? (item.soldPrice ?? item.listingPrice) : item.listingPrice;
  return (
    <section className="card space-y-3" aria-labelledby="profit-heading">
      <h2 id="profit-heading" className="font-bold">
        利益計算
      </h2>
      <ProfitCalculator
        key={item.id}
        initial={{ ...item.profit, salePrice: initialPrice, purchasePrice: item.purchasePrice }}
        quickPrices={analysis.suggestions.map((s) => ({ label: s.label, price: s.price }))}
        saveLabel={isSold ? "条件を保存（販売価格→売却価格）" : "条件を保存（販売価格→出品価格）"}
        onSave={async (v) => {
          const latest = (await getItem(item.id)) ?? item;
          await saveItem({
            ...latest,
            profit: { feeRate: v.feeRate, shippingCost: v.shippingCost, packagingCost: v.packagingCost },
            purchasePrice: v.purchasePrice,
            ...(isSold ? { soldPrice: v.salePrice } : { listingPrice: v.salePrice }),
          });
          toast("利益計算の条件を保存しました");
        }}
      />
      {analysis.status === "insufficient" && (
        <p className="text-xs muted">相場不明のため価格案ボタンは表示されません（相場分析タブで売却済みデータを登録してください）。</p>
      )}
    </section>
  );
}
