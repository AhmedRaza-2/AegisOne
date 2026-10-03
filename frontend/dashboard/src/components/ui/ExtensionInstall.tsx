"use client";
import { useState } from "react";
import { Download, Puzzle, Check, Copy, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api";
import { toast } from "@/components/ui/toast";

/**
 * One-click extension download for the signed-in user. The package is generated for THIS
 * account (the request carries the user's session), so after "Load unpacked" the extension is
 * already signed in - nothing to type.
 */
export function ExtensionInstall() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/public/download/extension`);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aegisone-extension.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setDownloaded(true);
    } catch {
      toast("Could not download the extension. Check that you are signed in and the server is reachable.", "error");
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText("chrome://extensions");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed — type chrome://extensions in the address bar.", "error");
    }
  };

  return (
    <div className="stat-card !p-6 max-w-2xl mx-auto">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0">
          <Puzzle className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-surface-900 dark:text-white">Install the browser extension</h3>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            Made for <span className="font-semibold text-surface-700 dark:text-surface-200">{user?.email}</span> — it signs in on its own.
          </p>

          <button
            onClick={download}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : downloaded ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {busy ? "Preparing…" : downloaded ? "Downloaded — download again" : "Download extension"}
          </button>

          <ol className="mt-5 space-y-2.5 text-sm text-surface-600 dark:text-surface-300">
            <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-surface-200 dark:bg-white/10 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span>Unzip the downloaded file.</span></li>
            <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-surface-200 dark:bg-white/10 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span className="flex flex-wrap items-center gap-2">Open
                <button onClick={copyUrl} className="inline-flex items-center gap-1.5 font-mono text-xs bg-surface-100 dark:bg-white/10 hover:bg-surface-200 dark:hover:bg-white/15 px-2 py-1 rounded-md transition-colors">
                  chrome://extensions {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
                <span className="text-surface-400 text-xs">(click to copy, then paste in a new tab)</span></span></li>
            <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-surface-200 dark:bg-white/10 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span>Turn on <b>Developer mode</b> (top right), click <b>Load unpacked</b>, and choose the unzipped folder.</span></li>
          </ol>

          <p className="mt-4 text-xs text-surface-400 leading-relaxed">
            Chrome only allows installing a single extension file from the Chrome Web Store, so this one-time step is needed for a direct download.
            The package contains your personal sign-in — don&apos;t share it with anyone.
          </p>
        </div>
      </div>
    </div>
  );
}
