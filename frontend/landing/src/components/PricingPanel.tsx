import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Sparkles, Shield, ArrowRight, Users, Zap } from 'lucide-react';
import { PRICING_PLANS, PricingPlan } from '../config/pricingConfig';

interface PricingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (planId: string, billingCycle: 'monthly' | 'annual') => void;
}

export default function PricingPanel({ isOpen, onClose, onSelectPlan }: PricingPanelProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        id="pricing-panel"
        initial={{ height: 0, opacity: 0, y: -10 }}
        animate={{ height: 'auto', opacity: 1, y: 0 }}
        exit={{ height: 0, opacity: 0, y: -10 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-7xl mx-auto my-6 overflow-hidden text-left"
      >
        <div className="relative bg-white/95 border border-[#E1EBF2] rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_-15px_rgba(10,94,214,0.12)] backdrop-blur-sm">
          {/* Panel Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-[#E1EBF2] pb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-[#0A5ED6] shadow-xs">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0A1931] tracking-tight mb-0">
                  Select AegisOne Security Package
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Pick the protection tier tailored for your workforce size.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Billing Cycle Switcher */}
              <div className="bg-[#F0F5FA] p-1 rounded-xl flex items-center gap-1 border border-[#E1EBF2]">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${billingCycle === 'monthly'
                    ? 'bg-white text-[#0A1931] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${billingCycle === 'annual'
                    ? 'bg-[#0A5ED6] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Annual
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-400 text-slate-950 font-bold tracking-wide">
                    SAVE 20%
                  </span>
                </button>
              </div>

              {/* Close Panel Button */}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors border border-slate-200"
                aria-label="Close pricing panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Package Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING_PLANS.map((plan: PricingPlan) => {
              const isPopular = plan.popular;
              const priceDisplay =
                billingCycle === 'annual' ? plan.annualEquivalentMonthly : plan.monthlyPrice;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between ${isPopular
                    ? 'bg-gradient-to-b from-blue-50/70 via-white to-indigo-50/40 border-2 border-[#0A5ED6] shadow-lg shadow-blue-500/10'
                    : 'bg-white border border-[#E1EBF2] shadow-xs hover:border-[#0A5ED6]/40 hover:shadow-md'
                    }`}
                >
                  {/* Highlight Badge */}
                  {plan.badge && (
                    <div className="absolute -top-3 left-6">
                      <span
                        className={`px-3 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-xs flex items-center gap-1 ${isPopular
                          ? 'bg-[#0A5ED6] text-white'
                          : 'bg-slate-800 text-slate-100'
                          }`}
                      >
                        {isPopular && <Sparkles className="w-3 h-3 text-amber-300" />}
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div>
                    {/* Header */}
                    <div className="mt-1 mb-4">
                      <h3 className="text-lg font-bold text-[#0A1931]">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {plan.tagline}
                      </p>
                    </div>

                    {/* Employee Target Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#F0F5FA] text-[#0A5ED6] border border-[#E1EBF2] mb-5">
                      <Users className="w-3.5 h-3.5 text-[#0A5ED6]" />
                      <span>{plan.employeeRangeLabel}</span>
                    </div>

                    {/* Pricing Display */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-[#0A1931] tracking-tight">
                          ${priceDisplay}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          / month
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {billingCycle === 'annual'
                          ? `Billed annually as $${plan.annualPrice}/yr`
                          : 'Billed monthly'}
                      </p>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2.5 border-t border-[#E1EBF2] pt-5">
                      {plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs">
                          <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#0A5ED6]" />
                          <span className="text-slate-600 font-medium">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="mt-8 pt-4">
                    <button
                      type="button"
                      onClick={() => onSelectPlan(plan.id, billingCycle)}
                      className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 group cursor-pointer ${isPopular
                        ? 'bg-[#0A5ED6] hover:bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-[#0A1931] hover:bg-slate-800 text-white'
                        }`}
                    >
                      <span>{plan.ctaText} & Register</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Enterprise Custom Note */}
          <div className="mt-6 p-4 rounded-2xl bg-[#F0F5FA] border border-[#E1EBF2] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0A5ED6]/10 text-[#0A5ED6] flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0A1931]">Need dedicated on-premise or air-gapped deployment?</p>
                <p className="text-[11px] text-slate-500">We offer custom deployment nodes for high-compliance financial and government institutions.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectPlan('enterprise', billingCycle)}
              className="px-4 py-2 rounded-lg border border-[#0A5ED6] text-[#0A5ED6] hover:bg-[#0A5ED6] hover:text-white font-semibold text-xs transition-all shrink-0 cursor-pointer"
            >
              Contact Architect
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
