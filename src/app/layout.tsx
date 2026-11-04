import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { ToastHost } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Mercari Listing OS",
  description: "個人のメルカリ出品を支援するローカルファーストWebアプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

// 初回描画前にテーマを適用してちらつきを防ぐ
const themeScript = `(function(){try{var t=localStorage.getItem('mlos-theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-24 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs muted sm:px-6">
          データはこのブラウザ内（IndexedDB）にのみ保存されます。メルカリへの自動アクセスは行いません。
        </footer>
        <ToastHost />
      </body>
    </html>
  );
}
