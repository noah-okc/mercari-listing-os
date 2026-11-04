"use client";

import { useEffect, useState } from "react";
import { getPhoto } from "@/lib/db";

/** IndexedDB の写真 Blob を objectURL で表示する */
export function PhotoThumb({ photoId, alt, className }: { photoId: string | undefined; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    if (photoId) {
      getPhoto(photoId).then((p) => {
        if (cancelled || !p) return;
        objectUrl = URL.createObjectURL(p.blob);
        setUrl(objectUrl);
      });
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);
  if (!url) {
    return (
      <div className={`grid place-items-center bg-zinc-100 text-xs muted dark:bg-zinc-800 ${className ?? ""}`} aria-label={alt}>
        写真なし
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={`${className?.includes("object-contain") ? "" : "object-cover"} ${className ?? ""}`} />;
}
