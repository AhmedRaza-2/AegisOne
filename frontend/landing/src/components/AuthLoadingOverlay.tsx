import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface AuthLoadingOverlayProps {
  /** Main headline shown above the flow, e.g. "Signing you in" */
  title?: string;
  /** Steps shown in sequence while waiting, e.g. ["Verifying credentials", "Contacting server", "Loading workspace"] */
  steps?: string[];
  /** Delay in ms before the first step message appears */
  startDelay?: number;
}

/**
 * Full-screen animated loading overlay for auth flows.
 * Shows a pulsing shield, a rotating set of step messages (so the UI never
 * looks "stuck"), and an indeterminate progress bar.
 */
export default function AuthLoadingOverlay({
  title = 'Signing you in',
  steps = ['Verifying credentials', 'Contacting secure server', 'Loading your workspace'],
  startDelay = 400,
}: AuthLoadingOverlayProps) {
  const [stepIndex, setStepIndex] = useState(-1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const start = setTimeout(() => setVisible(true), 60);
    const first = setTimeout(() => setStepIndex(0), startDelay);

    const interval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= steps.length - 1) return prev;
        return prev + 1;
      });
    }, 900);

    return () => {
      clearTimeout(start);
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [steps.length, startDelay]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#0A1931]/75 backdrop-blur-md transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-sm mx-4">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 text-center animate-scaleIn">
          {/* Animated shield logo */}
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-2xl bg-[#4A7FA7]/20 animate-ping" />
            <div className="absolute inset-0 rounded-2xl bg-[#4A7FA7]/10 animate-pulse" />
            <div className="relative w-20 h-20 bg-[#4A7FA7] rounded-2xl flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
          </div>

          <h3 className="font-sans text-lg font-bold text-[#0F172A] mb-1">{title}</h3>
          <p className="font-sans text-sm text-slate-400 mb-6">
            Securing your session…
          </p>

          {/* Step flow */}
          <div className="space-y-3 mb-6 text-left">
            {steps.map((step, i) => {
              const active = i === stepIndex;
              const done = i < stepIndex;
              return (
                <div key={step} className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : active
                          ? 'bg-[#4A7FA7] text-white'
                          : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {done ? (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : active ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-bold">{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={`font-sans text-sm transition-all duration-300 ${
                      done ? 'text-slate-400 line-through' : active ? 'text-[#0A1931] font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {step}
                    {active && (
                      <span className="inline-flex overflow-hidden align-bottom ml-1">
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            className="animate-bounce text-[#4A7FA7] font-bold"
                            style={{ animationDelay: `${d * 150}ms` }}
                          >
                            .
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
 
          {/* Indeterminate progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#4A7FA7] rounded-full animate-indeterminate" />
          </div>
        </div>
      </div>
    </div>
  );
}
