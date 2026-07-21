"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export default function LiveActivity() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">Live Activity</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Real-time tracking of current website analysis and browsing events.</p>
      </div>

      <div className="flex flex-col items-center justify-center p-20 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04]">
        <Activity className="w-12 h-12 text-[#4F84F8] animate-pulse mb-4" />
        <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Live Tracking Active</h2>
        <p className="text-surface-500 text-center max-w-md">
          This dashboard listens to real-time events from the AegisOne extension. As you browse, events will populate here instantly.
        </p>
      </div>
    </div>
  );
}
