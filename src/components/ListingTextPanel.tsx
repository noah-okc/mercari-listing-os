"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { listTemplates, saveItem } from "@/lib/db";
import { useLive } from "@/lib/useLive";
import { charLength, DESCRIPTION_MAX_LENGTH, generateDescription, generateTitles, missingFields, TITLE_MAX_LENGTH } from "@/lib/listing";
import { copyText } from "@/lib/image";
import type { Item } from "@/lib/types";
import { toast } from "./Toast";

async function copy(text: string, label: string) {
  if (!text.trim()) return toast(`${label}が空です`, "error");
  const ok = await copyText(text);
  toast(ok ? `${label}をコピーしました` : "コピーできませんでした。手動で選択してください", ok ? "info" : "error");
}

export function ListingTextPanel({ item }: { item: Item }) {
  const { data: templates } = useLive(listTemplates, []);
  const titles = useMemo(() => generateTitles(item), [item]);
  const missing = useMemo(() => missingFields(item), [item]);
  const [title, setTitle] = useState(item.listingTitle);
  const [desc, setDesc] = useState(item.listingDescription);
  const [templateId, setTemplateId] = useState("");
  const dirty = title !== item.listingTitle || desc !== item.listingDescription;

  const draft = () => {
    const tpl = templates?.find((t) => t.id === templateId);
    if (desc.trim() && !confirm("現在の説明文を下書きで置き換えますか？")) return;
    setDesc(generateDescription(item, tpl?.body));
  };

  const save = async () => {
    await saveItem({ ...item, listingTitle: title, listingDescription: desc });
    toast("出品文章を保存しました");
  };

  const titleLen = charLength(title);
  const descLen = charLength(desc);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        入力済みの情報だけで文章を作ります。真贋・年代・状態など<strong>未入力の情報は推測で補いません</strong>。出品前に必ず内容を確認してください。
        {missing.length > 0 && (
          <p className="mt-1 text-amber-700 dark:text-amber-300" data-testid="missing-fields">
            未入力（文章に含まれません）: {missing.join("、")}
          </p>
        )}
      </div>

      <section className="card space-y-3" aria-labelledby="titles-heading">
        <h2 id="titles-heading" className="font-bold">
          タイトル候補
        </h2>
        {titles.length === 0 ? (
          <p className="text-sm muted">ブランド・商品名・型番のいずれかを入力すると候補が表示されます。</p>
        ) : (
          <ol className="space-y-2" data-testid="title-candidates">
            {titles.map((t, i) => (
              <li key={t} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                <span className="text-xs muted">案{i + 1}</span>
                <span className="min-w-0 flex-1 break-all">{t}</span>
                <span className="text-xs muted tabular-nums">
                  {charLength(t)}/{TITLE_MAX_LENGTH}
                </span>
                <button type="button" className="btn btn-sm" onClick={() => setTitle(t)}>
                  採用
                </button>
                <button type="button" className="btn btn-sm" onClick={() => copy(t, "タイトル")}>
                  コピー
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card space-y-3" aria-labelledby="text-heading">
        <h2 id="text-heading" className="font-bold">
          出品文章
        </h2>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="l-title">
              タイトル
            </label>
            <span className={`text-xs tabular-nums ${titleLen > TITLE_MAX_LENGTH ? "text-red-600" : "muted"}`}>
              {titleLen}/{TITLE_MAX_LENGTH}
            </span>
          </div>
          <div className="flex gap-2">
            <input id="l-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button type="button" className="btn shrink-0" onClick={() => copy(title, "タイトル")}>
              コピー
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="l-template">
              定型文テンプレート
            </label>
            <select id="l-template" className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">使わない</option>
              {(templates ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn" onClick={draft}>
            説明文の下書きを作成
          </button>
          <Link href="/templates" className="btn">
            テンプレート管理
          </Link>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="l-desc">
              説明文
            </label>
            <span className={`text-xs tabular-nums ${descLen > DESCRIPTION_MAX_LENGTH ? "text-red-600" : "muted"}`}>
              {descLen}/{DESCRIPTION_MAX_LENGTH}
            </span>
          </div>
          <textarea id="l-desc" className="input min-h-64 font-mono text-sm leading-relaxed" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={() => copy(desc, "説明文")}>
            説明文をコピー
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty}>
            {dirty ? "保存する" : "保存済み"}
          </button>
        </div>
      </section>
    </div>
  );
}
