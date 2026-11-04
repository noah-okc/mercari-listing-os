"use client";

import { useEffect, useRef, useState } from "react";

export const MAX_PHOTOS = 20;

/** ファイル選択とプレビュー（保存前のローカルファイル用） */
export function PhotoPicker({
  files,
  onChange,
  max = MAX_PHOTOS,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [files]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">写真（{files.length}/{max}）</span>
        <button type="button" className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={files.length >= max}>
          ＋ 写真を追加
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="写真を選択"
        data-testid="photo-input"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
          onChange([...files, ...picked].slice(0, max));
          e.target.value = "";
        }}
      />
      {files.length === 0 ? (
        <p className="text-sm muted">写真は複数選択できます。1枚目がカバー写真になります。</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {urls.map((u, i) => (
            <li key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`写真${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
              {i === 0 && <span className="badge absolute top-1 left-1 bg-black/70 text-white">カバー</span>}
              <button
                type="button"
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/70 text-xs text-white"
                aria-label={`写真${i + 1}を削除`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
