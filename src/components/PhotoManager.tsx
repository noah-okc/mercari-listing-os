"use client";

import { useRef, useState } from "react";
import { addPhotos, deletePhoto, saveItem } from "@/lib/db";
import { resizeImage } from "@/lib/image";
import type { Item } from "@/lib/types";
import { PhotoThumb } from "./PhotoThumb";
import { MAX_PHOTOS } from "./PhotoPicker";
import { toast } from "./Toast";

/** 保存済み商品の写真管理（IndexedDB に即時保存） */
export function PhotoManager({ item }: { item: Item }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const onPick = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith("image/"));
    const room = MAX_PHOTOS - item.photoIds.length;
    if (!files.length || room <= 0) return;
    setBusy(true);
    try {
      const blobs = await Promise.all(files.slice(0, room).map((f) => resizeImage(f)));
      await addPhotos(item.id, blobs);
      toast(`写真を${blobs.length}枚追加しました`);
    } catch (e) {
      toast(`写真の追加に失敗しました: ${e instanceof Error ? e.message : e}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const makeCover = async (photoId: string) => {
    await saveItem({ ...item, photoIds: [photoId, ...item.photoIds.filter((p) => p !== photoId)] });
  };

  return (
    <section className="card" aria-labelledby="photos-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="photos-heading" className="font-bold">
          写真（{item.photoIds.length}/{MAX_PHOTOS}）
        </h2>
        <button type="button" className="btn btn-sm" disabled={busy || item.photoIds.length >= MAX_PHOTOS} onClick={() => inputRef.current?.click()}>
          {busy ? "追加中…" : "＋ 写真を追加"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label="写真を選択"
          data-testid="photo-input"
          onChange={(e) => {
            void onPick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {item.photoIds.length === 0 ? (
        <p className="text-sm muted">写真はまだありません。複数枚まとめて選択できます。</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" data-testid="photo-grid">
          {item.photoIds.map((pid, i) => (
            <li key={pid} className="group relative">
              <button type="button" className="block w-full" onClick={() => setPreview(pid)} aria-label={`写真${i + 1}を拡大`}>
                <PhotoThumb photoId={pid} alt={`写真${i + 1}`} className="aspect-square w-full rounded-lg" />
              </button>
              {i === 0 ? (
                <span className="badge absolute top-1 left-1 bg-black/70 text-white">カバー</span>
              ) : (
                <button type="button" className="badge absolute top-1 left-1 bg-black/60 text-white" onClick={() => makeCover(pid)}>
                  カバーにする
                </button>
              )}
              <button
                type="button"
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/70 text-xs text-white"
                aria-label={`写真${i + 1}を削除`}
                onClick={async () => {
                  if (confirm("この写真を削除しますか？")) await deletePhoto(item.id, pid);
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {preview && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          role="dialog"
          aria-label="写真プレビュー"
          onClick={() => setPreview(null)}
        >
          <PhotoThumb photoId={preview} alt="拡大写真" className="max-h-[85dvh] max-w-full rounded-lg object-contain" />
          <button type="button" className="btn mt-3" onClick={() => setPreview(null)}>
            閉じる
          </button>
        </div>
      )}
    </section>
  );
}
