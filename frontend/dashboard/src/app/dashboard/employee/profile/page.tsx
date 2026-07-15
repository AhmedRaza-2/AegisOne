"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { User, Laptop, ShieldCheck, Mail, Building } from "lucide-react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  const initials = user.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto mt-8">
      <motion.div variants={fadeUp} className="text-center mb-8">
        <div className="w-24 h-24 mx-auto rounded-full bg-brand-500/10 flex items-center justify-center text-3xl font-black text-brand-600 dark:text-brand-400 mb-4 border-4 border-brand-500/20">
          {initials}
        </div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">{user.fullName}</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 flex items-center justify-center gap-1 mt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Identity Protected
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div variants={fadeUp} className="stat-card">
          <h2 className="text-sm font-bold text-surface-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-500" /> Identity Info
          </h2>
          <div className="space-y-4">
            <div>
              <span className="text-xs text-surface-500">Email Address</span>
              <div className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2 mt-0.5"><Mail className="w-3.5 h-3.5 text-surface-400" /> {user.email}</div>
            </div>
            <div>
              <span className="text-xs text-surface-500">Organization</span>
              <div className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2 mt-0.5"><Building className="w-3.5 h-3.5 text-surface-400" /> {user.organization}</div>
            </div>
            <div>
              <span className="text-xs text-surface-500">Department</span>
              <div className="text-sm font-semibold text-surface-900 dark:text-white mt-0.5">{user.department}</div>
            </div>
            <div>
              <span className="text-xs text-surface-500">Access Role</span>
              <div className="text-sm font-semibold text-brand-600 dark:text-brand-400 mt-0.5 uppercase tracking-wider">{user.role}</div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="stat-card">
          <h2 className="text-sm font-bold text-surface-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Laptop className="w-4 h-4 text-brand-500" /> Device Fingerprint
          </h2>
          <div className="space-y-4">
            <div>
              <span className="text-xs text-surface-500">Device ID</span>
              <div className="text-sm font-mono font-semibold text-surface-900 dark:text-white mt-0.5 tracking-tight">dev_8a7b9c0d1e2f3g4h</div>
            </div>
            <div>
              <span className="text-xs text-surface-500">Browser Environment</span>
              <div className="text-sm font-semibold text-surface-900 dark:text-white mt-0.5">Google Chrome (v124.0.6367.118)</div>
            </div>
            <div>
              <span className="text-xs text-surface-500">Extension Version</span>
              <div className="text-sm font-semibold text-surface-900 dark:text-white mt-0.5">AegisOne Guard v2.1.0-prod</div>
            </div>
            <div>
              <span className="text-xs text-surface-500">Last Login IP</span>
              <div className="text-sm font-mono font-semibold text-surface-900 dark:text-white mt-0.5">192.168.1.104 (Local)</div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
