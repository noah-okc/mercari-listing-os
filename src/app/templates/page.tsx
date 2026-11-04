"use client";

import { useState } from "react";
import { deleteTemplate, listTemplates, saveTemplate } from "@/lib/db";
import { useLive } from "@/lib/useLive";
import { newId } from "@/lib/ids";
import { TEMPLATE_PLACEHOLDERS } from "@/lib/listing";
import { copyText } from "@/lib/image";
import type { Template } from "@/lib/types";
import { DemoBadge, EmptyState } from "@/components/ui";
import { toast } from "@/components/Toast";

const EXAMPLE = ["■ 発送について", "らくらくメルカリ便で発送予定です。", "", "{condition_note}", "", "ご不明点はコメントでお問い合わせください。"].join("\n");

export default function TemplatesPage() {
  const { data: templates } = useLive(listTemplates, []);
  const [editing, setEditing] = useState<Template | null>(null);

  const startNew = () => {
    const now = new Date().toISOString();
    setEditing({ id: newId(), name: "", body: EXAMPLE, isDemo: false, createdAt: now, updatedAt: now });
  };

  const sorted = [...(templates ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">定型文テンプレート</h1>
          <p className="text-sm muted">発送方法や注意書きなど、毎回使う文章を保存して説明文の下書きに差し込めます。</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startNew}>
          ＋ 新しいテンプレート
        </button>
      </div>

      {editing && (
        <form
          className="card space-y-3"
          aria-label="テンプレート編集"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editing.name.trim()) return toast("テンプレート名を入力してください", "error");
            await saveTemplate({ ...editing, name: editing.name.trim() });
            toast("テンプレートを保存しました");
            setEditing(null);
          }}
        >
          <div>
            <label className="label" htmlFor="t-name">
              テンプレート名
            </label>
            <input id="t-name" className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="t-body">
              本文
            </label>
            <textarea id="t-body" className="input min-h-48 font-mono text-sm" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            <p className="mt-1 text-xs muted">
              使えるプレースホルダ: {TEMPLATE_PLACEHOLDERS.map((p) => `${p.key}（${p.label}）`).join("、")}。
              値が未入力のプレースホルダを含む行は、推測で埋めずに行ごと省略されます。
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary">
              保存する
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <EmptyState title="テンプレートはまだありません" />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="template-list">
          {sorted.map((t) => (
            <li key={t.id} className="card space-y-2">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-medium">{t.name}</p>
                {t.isDemo && <DemoBadge />}
              </div>
              <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-50 p-2 text-xs whitespace-pre-wrap dark:bg-zinc-950">{t.body}</pre>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-sm" onClick={async () => toast((await copyText(t.body)) ? "コピーしました" : "コピーできませんでした")}>
                  コピー
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setEditing(t)}>
                  編集
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={async () => {
                    if (confirm(`「${t.name}」を削除しますか？`)) await deleteTemplate(t.id);
                  }}
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
