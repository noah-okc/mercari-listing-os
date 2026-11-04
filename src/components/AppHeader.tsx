"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "商品" },
  { href: "/calculator", label: "利益計算" },
  { href: "/templates", label: "定型文" },
  { href: "/data", label: "データ" },
];

export function AppHeader() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/items") : pathname.startsWith(href));
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold">
          <span className="grid size-7 place-items-center rounded-md bg-brand-600 text-sm text-white">M</span>
          <span className="hidden sm:inline">Listing OS</span>
        </Link>
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="メインメニュー">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${
                isActive(n.href)
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
