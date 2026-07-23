"use client";
import { UrlScanner } from "@/components/scanners/UrlScanner";
import { TextScanner } from "@/components/scanners/TextScanner";
import { FileScanner } from "@/components/scanners/FileScanner";
import { ImageScanner } from "@/components/scanners/ImageScanner";
import { motion } from "framer-motion";

const stagger = { show: { transition: { staggerChildren: 0.1 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } } };

export default function ManualScanCenter() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-7xl mx-auto space-y-8 pb-12">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">Manual Scan Center</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Deep analysis tools for URLs, text, documents, and visual media.</p>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UrlScanner />
        <TextScanner />
        <FileScanner />
        <ImageScanner />
      </motion.div>
    </motion.div>
  );
}
