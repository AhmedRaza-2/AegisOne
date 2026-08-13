"use client";
import { useState, useEffect } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const toast = (message: string, type: "success" | "error" = "success") => {
  if (typeof window !== "undefined") {
    const event = new CustomEvent("aegis-toast", { detail: { message, type } });
    window.dispatchEvent(event);
  }
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<{ id: number, message: string, type: "success" | "error" }[]>([]);

  useEffect(() => {
    const handleToast = (e: any) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, ...e.detail }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    };
    window.addEventListener("aegis-toast", handleToast);
    return () => window.removeEventListener("aegis-toast", handleToast);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border w-80 backdrop-blur-md pointer-events-auto ${
              t.type === 'error' 
                ? 'bg-red-50/95 dark:bg-red-950/95 border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-200' 
                : 'bg-emerald-50/95 dark:bg-[#111e18]/95 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-400'
            }`}
          >
            {t.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
            <p className="text-sm font-medium leading-snug whitespace-pre-line">{t.message}</p>
            <button 
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="ml-auto opacity-50 hover:opacity-100 transition-opacity mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
