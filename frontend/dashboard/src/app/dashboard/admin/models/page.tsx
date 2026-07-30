"use client";
import { modelHealth } from "@/lib/mock-data";
import { Activity, Cpu, Globe, Mail, FileText, Image, Zap, BarChart3, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

const modelIcons: Record<string, typeof Mail> = { email: Mail, url: Globe, text: FileText, image: Image, attachment: Cpu };
const modelDescs: Record<string, string> = {
  email: "DistilBERT (LoRA) + Bi-LSTM + Multi-Head Attention · 69.8M params · 150K training samples",
  url: "BERT + BiLSTM + GRU + Feature MLP · 4-class (Benign/Phishing/Malware/Defacement) · 500K URLs",
  text: "DistilBERT (LoRA) + Bi-LSTM · Shared backbone with Email · Short-form optimized (128 tokens)",
  image: "EfficientNet-B3 + SE Blocks · Transfer learning from ImageNet · 3,568 screenshots",
  attachment: "Orchestrator → Text extraction → URL extraction → Macro analysis → Multi-model delegation",
};

export default function ModelsPage() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <Activity className="w-6 h-6 text-brand-650 dark:text-brand-400" /> AI Model Health
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Real-time monitoring of all detection models</p>
      </motion.div>

      <div className="space-y-4">
        {modelHealth.map(m => {
          const Icon = modelIcons[m.key] || Cpu;
          return (
            <motion.div key={m.key} variants={fadeUp} className="glass-card p-6 hover:border-surface-300 dark:hover:border-white/[0.12] transition-all">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-brand-600/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="flex-1 w-full min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold text-surface-900 dark:text-white">{m.name}</h3>
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      m.status === "online" 
                        ? "bg-emerald-500/10 text-emerald-650 dark:text-emerald-450" 
                        : "bg-red-500/10 text-red-650 dark:text-red-405"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${m.status === "online" ? "bg-emerald-500" : "bg-red-500"}`} />
                      {m.status}
                    </span>
                  </div>
                  <p className="text-xs text-surface-500 dark:text-surface-400 font-mono mb-4">{modelDescs[m.key]}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="px-3 py-2 rounded-lg bg-surface-100/50 dark:bg-white/[0.02]">
                      <div className="flex items-center gap-1.5 text-[10px] text-surface-500 mb-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" /> Accuracy
                      </div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{m.accuracy}%</div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-surface-100/50 dark:bg-white/[0.02]">
                      <div className="flex items-center gap-1.5 text-[10px] text-surface-500 mb-1">
                        <Zap className="w-3 h-3 text-brand-500" /> Avg Latency
                      </div>
                      <div className="text-lg font-bold text-brand-650 dark:text-brand-400">{m.avgLatency}ms</div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-surface-100/50 dark:bg-white/[0.02]">
                      <div className="flex items-center gap-1.5 text-[10px] text-surface-500 mb-1">
                        <BarChart3 className="w-3 h-3 text-purple-500" /> Inferences
                      </div>
                      <div className="text-lg font-bold text-surface-800 dark:text-surface-200">{m.totalInferences.toLocaleString()}</div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-surface-100/50 dark:bg-white/[0.02]">
                      <div className="flex items-center gap-1.5 text-[10px] text-surface-500 mb-1">
                        <Clock className="w-3 h-3 text-amber-500" /> Last Check
                      </div>
                      <div className="text-sm font-semibold text-surface-700 dark:text-surface-300">{new Date(m.lastChecked).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
