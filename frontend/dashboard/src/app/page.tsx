<<<<<<< Updated upstream
import { redirect } from "next/navigation";

export default function RootRedirect() {
  redirect("/login");
=======
"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { Shield, Mail, Globe, FileSearch, Brain, ChevronRight, Zap, Eye, Lock, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { show: { transition: { staggerChildren: 0.1 } } };

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      const dest = user.role === "super_admin" ? "/dashboard/admin" : user.role === "office_admin" ? "/dashboard/supervisor" : "/dashboard/employee";
      router.replace(dest);
    }
  }, [user, router]);

  const features = [
    { icon: Mail, title: "Email Protection", desc: "DistilBERT + Bi-LSTM detects phishing emails with 99.43% accuracy in 33ms.", color: "text-blue-400" },
    { icon: Globe, title: "URL Scanning", desc: "4-class BERT model catches phishing, malware, and defacement URLs in <1ms.", color: "text-emerald-400" },
    { icon: FileSearch, title: "Attachment Analysis", desc: "Deep file inspection extracts text, URLs, and macros from PDFs, ZIPs, and Office files.", color: "text-amber-400" },
    { icon: Eye, title: "Visual Detection", desc: "EfficientNet-B3 identifies fake login pages and brand impersonation from screenshots.", color: "text-purple-400" },
    { icon: Brain, title: "Explainable AI", desc: "Every detection comes with human-readable reasoning — see exactly why AI flagged a threat.", color: "text-rose-400" },
    { icon: Lock, title: "Browser Extension", desc: "Chrome extension scans links in real-time, badges Google results, intercepts downloads.", color: "text-cyan-400" },
  ];

  const stats = [
    { value: "99.43%", label: "Email Accuracy" },
    { value: "98.05%", label: "URL Accuracy" },
    { value: "<50ms", label: "Response Time" },
    { value: "5", label: "AI Models" },
  ];

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-white transition-colors duration-300">
      {/* ── Nav ─────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-surface-200 dark:border-white/[0.06] bg-white/80 dark:bg-surface-950/80 backdrop-blur-lg transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-brand-600 dark:text-brand-500" />
            <span className="text-lg font-bold tracking-tight text-surface-900 dark:text-white">AegisOne</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-surface-500 dark:text-surface-400">
            <a href="#features" className="hover:text-surface-900 dark:hover:text-white transition-colors">Features</a>
            <a href="#models" className="hover:text-surface-900 dark:hover:text-white transition-colors">AI Models</a>
            <a href="#stats" className="hover:text-surface-900 dark:hover:text-white transition-colors">Performance</a>
          </div>
          <button
            onClick={() => router.push("/login")}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Login
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6">
        <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-4xl mx-auto text-center">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-500/20 bg-brand-500/5 text-brand-600 dark:text-brand-400 text-xs font-medium mb-6">
            <Zap className="w-3.5 h-3.5" /> In-House AI Security Platform
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-4xl md:text-6xl font-bold leading-tight tracking-tight text-surface-900 dark:text-white">
            Stop Phishing Attacks{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-cyan-500 dark:from-brand-400 dark:to-cyan-400">Before They Strike</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-5 text-lg text-surface-500 dark:text-surface-400 max-w-2xl mx-auto leading-relaxed">
            AI-powered multi-channel protection across email, browser, URLs, and attachments.
            Deployed entirely within your infrastructure — zero data leaves your boundary.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={() => router.push("/login")}
              className="px-7 py-3 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-all shadow-glow hover:shadow-glow-lg flex items-center gap-2"
            >
              Get Started <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="px-7 py-3 border border-surface-200 dark:border-white/10 hover:border-surface-300 dark:hover:border-white/20 text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white font-medium rounded-lg transition-all"
            >
              Learn More
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Stats ───────────────────────────────────── */}
      <section id="stats" className="py-12 border-y border-surface-200 dark:border-white/[0.06] bg-surface-100/30 dark:bg-white/[0.01]">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-surface-900 dark:text-white">{s.value}</div>
              <div className="mt-1 text-sm text-surface-500 dark:text-surface-400">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-surface-900 dark:text-white">Multi-Channel AI Protection</h2>
            <p className="mt-3 text-surface-500 dark:text-surface-400 max-w-xl mx-auto">Five specialized AI models working together to cover every attack surface.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-6 hover:border-brand-500/20 hover:bg-brand-500/[0.01] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.05] transition-all group"
              >
                <f.icon className={`w-9 h-9 ${f.color} mb-4 group-hover:scale-110 transition-transform`} />
                <h3 className="text-lg font-semibold mb-2 text-surface-900 dark:text-white">{f.title}</h3>
                <p className="text-sm text-surface-500 dark:text-surface-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Models ──────────────────────────────── */}
      <section id="models" className="py-20 px-6 bg-surface-100/30 dark:bg-white/[0.01] border-y border-surface-200 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-surface-900 dark:text-white">AI Model Architecture</h2>
            <p className="mt-3 text-surface-500 dark:text-surface-400">Research-backed deep learning models trained on 500K+ samples.</p>
          </motion.div>
          <div className="grid gap-4">
            {[
              { name: "Email AI", arch: "DistilBERT (LoRA) + Bi-LSTM + Multi-Head Attention", acc: "99.43%", speed: "33ms", dataset: "150K emails" },
              { name: "URL AI", arch: "BERT + BiLSTM + GRU + Feature MLP (4-class)", acc: "98.05%", speed: "<1ms", dataset: "500K URLs" },
              { name: "Image AI", arch: "EfficientNet-B3 + SE Attention Blocks", acc: "89.5%", speed: "52ms", dataset: "3.5K screenshots" },
              { name: "Text AI", arch: "DistilBERT (LoRA) + Bi-LSTM (shared backbone)", acc: "97.2%", speed: "41ms", dataset: "Shared" },
              { name: "Attachment AI", arch: "Orchestrator → Text + URL + Heuristic Analysis", acc: "94.0%", speed: "105ms", dataset: "Composite" },
            ].map((m, i) => (
              <motion.div key={m.name} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="glass-card p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="font-semibold text-surface-900 dark:text-white">{m.name}</div>
                  <div className="text-sm text-surface-500 dark:text-surface-400 mt-0.5 font-mono">{m.arch}</div>
                </div>
                <div className="flex gap-6 text-sm">
                  <div><span className="text-surface-500 dark:text-surface-400">Accuracy</span> <span className="block font-semibold text-emerald-600 dark:text-emerald-400">{m.acc}</span></div>
                  <div><span className="text-surface-500 dark:text-surface-400">Latency</span> <span className="block font-semibold text-brand-600 dark:text-brand-400">{m.speed}</span></div>
                  <div><span className="text-surface-500 dark:text-surface-400">Dataset</span> <span className="block font-semibold text-surface-700 dark:text-surface-300">{m.dataset}</span></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 dark:text-white">Ready to Secure Your Organization?</h2>
          <p className="mt-4 text-surface-500 dark:text-surface-400">Deploy AegisOne within your infrastructure and start protecting employees today.</p>
          <button onClick={() => router.push("/login")} className="mt-8 px-8 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-all shadow-glow hover:shadow-glow-lg inline-flex items-center gap-2">
            Access Dashboard <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-surface-200 dark:border-white/[0.06] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-surface-500 dark:text-surface-400">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-600 dark:text-brand-500" />
            <span>AegisOne Platform Technologies</span>
          </div>
          <div>© {new Date().getFullYear()} AegisOne. All rights reserved. Enterprise Threat Protection.</div>
        </div>
      </footer>
    </div>
  );
>>>>>>> Stashed changes
}
