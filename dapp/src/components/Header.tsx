"use client";

import Link from "next/link";
import { ConnectKitButton } from "connectkit";

export function Header() {
  return (
    <header className="border-b border-ink/30 bg-paper sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="font-serif text-xl text-terracotta">&#x29B5;</span>
              <span className="font-serif text-xl tracking-tight text-ink">
                Plimsoll
              </span>
            </Link>
            <span className="font-mono text-[10px] text-ink/50 uppercase tracking-widest ml-2">
              Fleet Command
            </span>
          </div>
          <ConnectKitButton />
        </div>
      </div>
    </header>
  );
}
