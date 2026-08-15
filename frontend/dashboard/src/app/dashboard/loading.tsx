"use client";

import { Shield } from "lucide-react";

export default function Loading() {
  return (
    <div className="w-full h-full min-h-[60vh] flex items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-3">
        <Shield className="w-8 h-8 text-brand-500 animate-pulse" />
        <span className="text-xs font-medium text-surface-500 dark:text-surface-400">Loading...</span>
      </div>
    </div>
  );
}
