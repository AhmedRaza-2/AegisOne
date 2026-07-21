"use client";
import { useAuth } from "@/lib/auth-context";
import { FileText, Download } from "lucide-react";

export default function ReportsAndHistory() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">Reports & History</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Review your historical data and export personal security reports.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#4F84F8] text-white hover:bg-[#3D6CE5] transition-colors">
          <Download className="w-4 h-4" />
          Export Data
        </button>
      </div>

      <div className="flex flex-col items-center justify-center p-20 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04]">
        <FileText className="w-12 h-12 text-surface-300 dark:text-surface-600 mb-4" />
        <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Historical Logs</h2>
        <p className="text-surface-500 text-center max-w-md">
          Your full history of scanned websites, downloaded files, and blocked threats will appear here.
        </p>
      </div>
    </div>
  );
}
