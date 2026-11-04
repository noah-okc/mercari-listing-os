"use client";

import { useRef, useState } from "react";
import {
  clearAll,
  deleteDemoData,
  exportAll,
  importAll,
  listComparables,
  listItems,
  listTemplates,
  saveComparables,
  saveItem,
  saveTemplate,
} from "@/lib/db";
import { useLive } from "@/lib/useLive";
import { buildExport, parseImport } from "@/lib/exportFormat";
import { comparablesFromCsv, comparablesToCsv } from "@/lib/csv";
import { buildDemoData } from "@/lib/demo";
import { downloadBlob } from "@/lib/image";
import { todayYmd } from "@/lib/format";
import { toast } from "@/components/Toast";

export default function DataPage() {
  const { data: stats } = useLive(async () => {
    const [items, comps, templates] = await Promise.all([listItems(), listComparables(), listTemplates()]);
    return {
      items: items.length,
      demoItems: items.filter((i) => i.isDemo).length,
      comps: comps.length,
      demoComps: comps.filter((c) => c.isDemo).length,
      templates: templates.length,
      itemIds: new Set(items.map((i) => i.id)),
    };
  }, []);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [messages, setMessages] = useState<string[]>([]);
  const jsonRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    const data = await exportAll(includePhotos);
    const file = buildExport(data);
    downloadBlob(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }), `mercari-listing-os-${todayYmd()}.json`);
    toast(`商品${file.items.length}件をエクスポートしました`);
  };

  const doImport = async (f: File) => {
    try {
      const parsed = parseImport(await f.text());
      if (!confirm(`商品${parsed.items.length}件・相場データ${parsed.comparables.length}件・テンプレート${parsed.templates.length}件・写真${parsed.photos.length}枚を取り込みます。同じIDのデータは上書きされます。よろしいですか？`)) return;
      await importAll(parsed);
      setMessages([`インポートしました（商品${parsed.items.length}件）`, ...parsed.warnings]);
      toast("インポートしました");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages([`インポート失敗: ${msg}`]);
      toast(msg, "error");
    }
  };

  const doCsvImport = async (f: File) => {
    const result = comparablesFromCsv(await f.text());
    const known = result.comparables.filter((c) => stats?.itemIds.has(c.itemId));
    const unknown = result.comparables.length - known.length;
    if (known.length) await saveComparables(known);
    setMessages([
      `相場データ ${known.length} 件を取り込みました`,
      ...(unknown ? [`${unknown} 件は item_id に一致する商品が無いためスキップしました`] : []),
      ...result.errors.map((e) => `${e.line}行目: ${e.message}`),
    ]);
  };

  const loadDemo = async () => {
    const demo = buildDemoData();
    for (const item of demo.items) await saveItem(item);
    await saveComparables(demo.comparables);
    for (const t of demo.templates) await saveTemplate(t);
    toast("デモデータを読み込みました");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">データ管理</h1>
        <p className="text-sm muted">
          保存データ: 商品 {stats?.items ?? 0} 件（うちデモ {stats?.demoItems ?? 0}）・相場データ {stats?.comps ?? 0} 件（うちデモ{" "}
          {stats?.demoComps ?? 0}）・テンプレート {stats?.templates ?? 0} 件
        </p>
      </div>

      {messages.length > 0 && (
        <ul className="card space-y-1 text-sm" role="status" data-testid="data-messages">
          {messages.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}

      <section className="card space-y-3">
        <h2 className="font-bold">JSON バックアップ</h2>
        <p className="text-sm muted">全データ（商品・相場データ・テンプレート、任意で写真）を1ファイルに書き出します。インポート時は同じIDを上書きし、他は追加します。</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} />
          写真を含める（ファイルサイズが大きくなります）
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={doExport}>
            JSONをエクスポート
          </button>
          <button type="button" className="btn" onClick={() => jsonRef.current?.click()}>
            JSONをインポート
          </button>
          <input
            ref={jsonRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="JSONファイルを選択"
            data-testid="json-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">相場データ CSV</h2>
        <p className="text-sm muted">
          全商品の相場データをまとめて入出力します。列: item_id, title, price, price_type(sold/listed), observed_at(YYYY-MM-DD), source, condition, size,
          url, note。商品ごとの取込は各商品の「相場分析」タブからも行えます。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const comps = await listComparables();
              downloadBlob(new Blob([comparablesToCsv(comps)], { type: "text/csv;charset=utf-8" }), `comparables-${todayYmd()}.csv`);
            }}
          >
            CSVをエクスポート
          </button>
          <button type="button" className="btn" onClick={() => csvRef.current?.click()}>
            CSVをインポート
          </button>
          <input
            ref={csvRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="CSVファイルを選択"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doCsvImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">デモデータ</h2>
        <p className="text-sm muted">
          操作を試すための<strong>架空の</strong>商品・相場データです。実在の成約価格ではありません。画面上では「デモ」バッジで区別され、まとめて削除できます。
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={loadDemo}>
            デモデータを読み込む
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!stats?.demoItems && !stats?.demoComps}
            onClick={async () => {
              const n = await deleteDemoData();
              toast(`デモデータを削除しました（商品${n}件）`);
            }}
          >
            デモデータを削除
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold text-red-700 dark:text-red-400">すべて削除</h2>
        <p className="text-sm muted">このブラウザに保存された全データを削除します。元に戻せないため、先にエクスポートしてください。</p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            if (!confirm("全データを削除します。元に戻せません。よろしいですか？")) return;
            await clearAll();
            toast("全データを削除しました");
          }}
        >
          全データを削除
        </button>
      </section>
    </div>
  );
}
