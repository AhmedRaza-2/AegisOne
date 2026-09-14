"use client";

export default function Loading() {
  return (
    <div className="w-full h-full min-h-[60vh] flex items-center justify-center bg-transparent">
      <div className="flex gap-2 items-center justify-center">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce"></div>
      </div>
    </div>
  );
}
