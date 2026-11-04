"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addPhotos, createEmptyItem, saveItem } from "@/lib/db";
import { resizeImage } from "@/lib/image";
import { ItemForm, pickFormValues } from "@/components/ItemForm";
import { PhotoPicker } from "@/components/PhotoPicker";
import { toast } from "@/components/Toast";

export default function NewItemPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [template] = useState(() => createEmptyItem());

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2 text-sm muted">
        <Link href="/" className="hover:underline">
          商品一覧
        </Link>
        <span>/</span>
        <span>新規登録</span>
      </div>
      <h1 className="text-xl font-bold">商品を登録</h1>
      <div className="card">
        <ItemForm
          initial={pickFormValues(template)}
          submitLabel="登録する"
          onSubmit={async (values) => {
            const item = await saveItem({ ...createEmptyItem(), ...values });
            if (files.length) {
              const blobs = await Promise.all(files.map((f) => resizeImage(f)));
              await addPhotos(item.id, blobs);
            }
            toast("商品を登録しました");
            router.push(`/items/${item.id}`);
          }}
        >
          <PhotoPicker files={files} onChange={setFiles} />
        </ItemForm>
      </div>
    </div>
  );
}
