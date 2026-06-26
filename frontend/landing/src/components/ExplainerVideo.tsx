import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCw, ArrowRight, Copy, Check, Info, Sparkles, 
  Tv, Building, Layers, Laptop, AlertTriangle, ShieldAlert, Shield, 
  Terminal, ShieldCheck, Mail, Users, BarChart3, Lock
} from 'lucide-react';

interface ExplainerVideoProps {
  onShowNotification: (msg: string) => void;
}

export default function ExplainerVideo({ onShowNotification }: ExplainerVideoProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [copied, setCopied] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const frames = [
    {
      id: 0,
      timeRange: '0:00 - 0:02',
      title: 'AegisOne Protected Headquarters',
      desc: 'The camera approaches a modern, sleek corporate office building. A glowing security perimeter protects the organization from outside threats.',
      icon: Building,
      color: 'border-blue-500/30 text-blue-500'
    },
    {
      id: 1,
      timeRange: '0:02 - 0:04',
      title: 'Multi-Floor Operations cross-section',
      desc: 'Moving inside the office space to reveal structured departments (HR, Finance, Sales) working in complete isolation and safety.',
      icon: Layers,
      color: 'border-cyan-500/30 text-cyan-500'
    },
    {
      id: 2,
      timeRange: '0:04 - 0:06',
      title: 'Armed Endpoint Protection Active',
      desc: 'Zooming in on employee workstations. Every desktop has the lightweight AegisOne extension and endpoint agent loaded and armed.',
      icon: Laptop,
      color: 'border-indigo-500/30 text-indigo-500'
    },
    {
      id: 3,
      timeRange: '0:06 - 0:08',
      title: 'Outside Hacker Launch Vector',
      desc: 'Contrast shift to a dark stealth setup. A malicious actor dispatches a sophisticated password-stealing phishing vector toward corporate emails.',
      icon: ShieldAlert,
      color: 'border-red-500/30 text-red-500'
    },
    {
      id: 4,
      timeRange: '0:08 - 0:10',
      title: 'Phishing Email Received',
      desc: 'The employee receives a deceptive email labeled "Urgent Action Required" with a malicious spoofed login link, and goes to click.',
      icon: Mail,
      color: 'border-amber-500/30 text-amber-500'
    },
    {
      id: 5,
      timeRange: '0:10 - 0:12',
      title: 'Zero-Latency Sovereign Shield Intercept',
      desc: 'Right before the click loads, AegisOne instantly blocks the link! The connection is discarded in memory. Safe, private, and silent.',
      icon: Shield,
      color: 'border-emerald-500/30 text-emerald-500'
    },
    {
      id: 6,
      timeRange: '0:12 - 0:14',
      title: 'Instant IT Console Logging',
      desc: 'The blocked threat event is registered on the central organization console. Network administrators get complete telemetry instantly.',
      icon: Terminal,
      color: 'border-blue-600/30 text-blue-400'
    },
    {
      id: 7,
      timeRange: '0:14 - 0:16',
      title: 'Role-Based Severity Routing',
      desc: 'The incident notifies relevant Managers, Team Leads, and Admins based on severity, allowing secure localized containment.',
      icon: Users,
      color: 'border-purple-500/30 text-purple-400'
    },
    {
      id: 8,
      timeRange: '0:16 - 0:18',
      title: 'Interactive Analytics & Health Graphs',
      desc: 'Reviewing real-time corporate statistics. Total threats shielded scales up, while data leaks remain at a flat zero bytes.',
      icon: BarChart3,
      color: 'border-emerald-600/30 text-emerald-400'
    },
    {
      id: 9,
      timeRange: '0:18 - 0:20',
      title: 'AegisOne Brand Outro',
      desc: 'Sovereign protection for local offices and SMEs. Secure. Protect. Prevent. Zero-trust architecture you own entirely.',
      icon: ShieldCheck,
      color: 'border-[#0A5ED6]/30 text-white'
    }
  ];

  // Auto playback animation cycle
  useEffect(() => {
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % frames.length);
      }, 3500); // 3.5 seconds per frame
    } else if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPlaying]);

  const handleFrameSelect = (idx: number) => {
    setIsPlaying(false);
    setCurrentFrame(idx);
  };

  const handleCopyPrompt = () => {
    const promptText = `Symmetric cinematic 3D explainer video for cyber security product "AegisOne". Smooth 24fps, high-contrast professional corporate cyber defense style.
0:00-0:02: Camera pans up to a modern sleek concrete and glass corporate office headquarters. A holographic blue shield with the name "AegisOne" glows above the entrance.
0:02-0:04: Smooth x-ray camera transition inside the building, showing three floors with employees: HR Department on top, Finance Department in middle, Sales Department on bottom, working in clean, modern, well-lit spaces.
0:04-0:06: Zoom onto an employee's desk. Clean dual-monitor setup. On screen, a browser extension labeled "AegisOne Link Protection" shines with a pulsating green checkmark.
0:06-0:08: Contrast shift to a dark room with a hacker in a black hoodie typing on a glowing red laptop, sending a malicious link labeled "Phishing Link".
0:08-0:10: Close-up on the employee's screen. A fake email pops up: "Urgent Action Required! Click here to verify http://secure-update-login.com". The mouse cursor moves closer, about to click.
0:10-0:12: The moment the user clicks, a high-tech glowing 3D red barrier materializes, deflecting the link with an "AegisOne Intercepted - Malicious Link Blocked" alert.
0:12-0:14: Camera swoops to the IT department. The threat event is instantly logged on a clean dark telemetry dashboard.
0:14-0:16: Holographic organizational structure tree showing alerts routing to "Super Admin", "Security Manager", and "Team Lead".
0:16-0:18: Cyber security line graphs scaling upwards, with "Threats Shielded: 1,248" and "Data Leaks: 0 Bytes" in green lettering.
0:18-0:20: Cinematic final shot showing a futuristic glowing steel shield with "AegisOne: Secure. Protect. Prevent." styled in premium deep-blue and silver lighting.`;

    navigator.clipboard.writeText(promptText);
    setCopied(true);
    onShowNotification("AI Video Generator Prompt copied! Paste into Sora, Runway, or Kling.");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <section id="how-it-works" className="min-h-[100dvh] flex flex-col justify-center py-20 bg-slate-950 text-white relative overflow-hidden border-t border-b border-slate-900">
      {/* Decorative cyber grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-25 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#0A5ED6]/10 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Header Block */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 bg-[#0A5ED6]/15 border border-[#0A5ED6]/30 px-3.5 py-1.5 rounded-full">
            <Tv className="w-3.5 h-3.5 text-[#0A5ED6]" />
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-blue-400">
              Interactive 3D Simulation
            </span>
          </div>
          <h2 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-white">
            See AegisOne <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">How It Works</span> in 20 Seconds
          </h2>
          <p className="font-sans text-sm text-slate-400 leading-relaxed">
            Take a self-guided animated tour of our threat containment. From office deployment to real-time email link intercepting, watch how our perimeter stands guard without inspecting private data.
          </p>
        </div>

        {/* Master Row Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Side: High Fidelity 16:9 Simulated Video Player View (7 columns) */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-slate-900/90 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl min-h-[500px]">
            {/* Camera Frame Corners */}
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-slate-700 pointer-events-none" />
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-slate-700 pointer-events-none" />
            <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-slate-700 pointer-events-none" />
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-slate-700 pointer-events-none" />

            {/* Simulated Live View Finder Badge */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 font-bold">AegisOne_Explainer.mp4</span>
              </div>
              <div className="font-mono text-[10px] text-[#0A5ED6] font-semibold bg-[#0A5ED6]/10 px-2.5 py-0.5 rounded-full">
                {frames[currentFrame].timeRange} / 0:20
              </div>
            </div>

            {/* Dynamic Interactive Slide Stage */}
            <div className="flex-1 flex items-center justify-center my-4 min-h-[250px] relative">
              
              {/* FRAME 0: Office Building */}
              {currentFrame === 0 && (
                <div className="w-full h-full flex flex-col items-center justify-center animate-fadeIn relative">
                  <div className="relative w-44 h-44 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between p-4 shadow-2xl overflow-hidden scale-105 transition-all">
                    {/* Sky grid background */}
                    <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] bg-[size:12px_12px] opacity-15 pointer-events-none" />
                    
                    {/* Security laser sweep line */}
                    <div className="absolute left-0 right-0 h-[1.5px] bg-blue-500/80 animate-bounce top-1/3 shadow-[0_0_8px_#3b82f6]" />

                    {/* Window arrays */}
                    <div className="grid grid-cols-4 gap-1.5 relative z-10">
                      {[...Array(16)].map((_, i) => (
                        <div key={i} className="h-2 bg-slate-850 rounded-[1px] animate-pulse border border-slate-800" />
                      ))}
                    </div>

                    {/* Ground floor gates */}
                    <div className="flex items-end justify-between border-t border-slate-850 pt-2 relative z-10">
                      <div className="w-3.5 h-5 bg-blue-500/10 border-t border-x border-blue-500/30 rounded-t" />
                      <span className="font-sans text-[7px] font-bold tracking-wider text-blue-400">AEGIS_HQ</span>
                      <div className="w-3.5 h-5 bg-blue-500/10 border-t border-x border-blue-500/30 rounded-t" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 bg-[#0A5ED6]/10 border border-[#0A5ED6]/30 px-3 py-1 rounded-full text-xs font-mono text-blue-400 flex items-center gap-1.5 animate-bounce">
                    <Shield className="w-3.5 h-3.5 text-[#0A5ED6]" /> Sovereign Link Protection Active
                  </div>
                </div>
              )}

              {/* FRAME 1: Floors Cross Section */}
              {currentFrame === 1 && (
                <div className="w-full h-full flex flex-col items-center justify-center animate-fadeIn">
                  <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-850 overflow-hidden shadow-2xl">
                    {/* Floor 3 */}
                    <div className="p-3.5 flex items-center justify-between bg-slate-900/40">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">FL 3</span>
                        <span className="font-sans text-xs font-bold text-white">HR Department</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">100% Protected</span>
                    </div>
                    {/* Floor 2 */}
                    <div className="p-3.5 flex items-center justify-between bg-slate-900/60">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">FL 2</span>
                        <span className="font-sans text-xs font-bold text-white">Finance Department</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">100% Protected</span>
                    </div>
                    {/* Floor 1 */}
                    <div className="p-3.5 flex items-center justify-between bg-slate-900/40">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">FL 1</span>
                        <span className="font-sans text-xs font-bold text-white">Sales &amp; Logistics</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">100% Protected</span>
                    </div>
                  </div>
                </div>
              )}

              {/* FRAME 2: Endpoint Armed */}
              {currentFrame === 2 && (
                <div className="w-full h-full flex flex-col items-center justify-center animate-fadeIn relative">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 w-72 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-700" />
                        <span className="w-2 h-2 rounded-full bg-slate-700" />
                        <span className="w-2 h-2 rounded-full bg-slate-700" />
                      </div>
                      <span className="font-mono text-[8px] text-slate-500">AegisOne Engine v2.4</span>
                    </div>
                    
                    <div className="space-y-2.5">
                      <div className="p-3 bg-blue-950/20 border border-blue-500/30 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Laptop className="w-4 h-4 text-[#0A5ED6]" />
                          <span className="font-sans text-xs text-white font-bold">Sovereign Agent</span>
                        </div>
                        <span className="font-mono text-[9px] text-emerald-400 uppercase font-bold animate-pulse">Running</span>
                      </div>
                      
                      <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-cyan-400" />
                          <span className="font-sans text-xs text-white font-bold">Browser Extension</span>
                        </div>
                        <span className="font-mono text-[9px] text-emerald-400 uppercase font-bold">Armed</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FRAME 3: Outside Hacker Attack */}
              {currentFrame === 3 && (
                <div className="w-full h-full flex flex-col items-center justify-center animate-fadeIn relative">
                  <div className="bg-red-950/25 border border-red-500/30 rounded-xl p-5 max-w-sm text-center space-y-3 shadow-xl">
                    <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto text-red-500">
                      <AlertTriangle className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-sans text-xs font-bold text-red-400 uppercase tracking-wider">MALICIOUS ACTOR VECTOR</h4>
                      <p className="font-mono text-[10px] text-slate-400">Target: info@company.com • Source: Anonymous Edge Node</p>
                    </div>
                    <div className="bg-slate-950 border border-red-500/20 rounded px-2.5 py-1.5 font-mono text-[9px] text-red-400 inline-block">
                      POST /payload/credential-grabber-link
                    </div>
                  </div>
                </div>
              )}

              {/* FRAME 4: Phishing Email Received */}
              {currentFrame === 4 && (
                <div className="w-full h-full flex flex-col items-center justify-center animate-fadeIn">
                  <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden shadow-2xl w-full max-w-sm text-left">
                    {/* Mail Header */}
                    <div className="bg-slate-900 px-3 py-2 border-b border-slate-850 flex items-center justify-between">
                      <span className="font-sans text-[10px] text-slate-400">Outlook / Webmail Client</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    </div>
                    {/* Mail content */}
                    <div className="p-4 space-y-3">
                      <div>
                        <span className="text-slate-500 text-[10px] block">From: security-verify-microsoft@external-auth-portal.com</span>
                        <strong className="text-white text-xs font-sans mt-0.5 block">Action Required: Verify Employee Account Info Now</strong>
                      </div>
                      
                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-850 text-[11px] text-slate-300">
                        Please re-authenticate your corporate login credentials instantly to avoid suspension:
                        <div className="mt-2 bg-slate-950 p-2 rounded text-amber-400 font-mono text-[9px] break-all border border-amber-500/20 select-none">
                          http://secure-update-login.com
                        </div>
                      </div>

                      <div className="text-[10px] text-amber-500 italic flex items-center gap-1.5 bg-amber-500/5 p-2 rounded">
                        <Info className="w-3.5 h-3.5 shrink-0" /> User mouse cursor is hovering, ready to click...
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FRAME 5: Shield Intervention Intercept */}
              {currentFrame === 5 && (
                <div className="w-full h-full flex flex-col items-center justify-center animate-fadeIn">
                  <div className="bg-slate-950 border-2 border-emerald-500 rounded-2xl p-6 text-center max-w-sm space-y-4 shadow-[0_0_35px_rgba(16,185,129,0.15)] relative overflow-hidden">
                    {/* Grid overlay */}
                    <div className="absolute inset-0 bg-radial-gradient(circle_at_center,rgba(16,185,129,0.06)_0%,transparent_70%) pointer-events-none" />
                    
                    <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto text-emerald-400 animate-[bounce_1s_infinite]">
                      <ShieldCheck className="w-8 h-8" />
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-sans text-sm font-black text-emerald-400 uppercase tracking-widest">PHISHING DETECTED &amp; BLOCKED</h4>
                      <p className="font-sans text-xs text-slate-300">
                        AegisOne sovereign parser intercepted the request before it loaded. The connection was isolated and dumped.
                      </p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded px-3 py-2 font-mono text-[9px] text-slate-400 space-y-1 text-left">
                      <div><strong className="text-red-400">LINK:</strong> secure-update-login.com</div>
                      <div><strong className="text-emerald-400">STATE:</strong> TERMINATED (0 Bytes Dispatched)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* FRAME 6: IT Console Logged */}
              {currentFrame === 6 && (
                <div className="w-full h-full flex flex-col items-center justify-center animate-fadeIn">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 w-full max-w-sm font-mono text-left space-y-3 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">AegisOne Terminal Audit Logs</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    </div>

                    <div className="text-[10px] space-y-1.5 text-slate-300">
                      <div className="text-slate-500">2026-06-26 11:05:42 PKT - Scanning employee DNS lookup...</div>
                      <div className="text-red-400 font-semibold flex items-center gap-1">
                        [!] Threat Match: secure-update-login.com
                      </div>
                      <div className="text-emerald-400 font-semibold">
                        [✓] Active Intercept triggered (Action: Terminate Process)
                      </div>
                      <div className="text-slate-400">
                        [i] Status: Log generated on local Postgres DB instance.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FRAME 7: Hierarchy severity Routing */}
              {currentFrame === 7 && (
                <div className="w-full h-full flex flex-col items-center justify-center animate-fadeIn">
                  <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 w-72 text-center space-y-3.5 shadow-2xl">
                    <h4 className="font-sans text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dynamic Incident Routing</h4>
                    
                    <div className="space-y-2">
                      {/* Super Admin */}
                      <div className="p-2 bg-blue-950/20 border border-[#0A5ED6]/30 rounded-lg text-xs font-bold text-white flex items-center justify-between">
                        <span>🛡️ Super Admin Panel</span>
                        <span className="font-mono text-[9px] text-slate-400">Full control &amp; compliance</span>
                      </div>

                      <div className="h-3 w-[1.5px] bg-slate-800 mx-auto" />

                      {/* Manager */}
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-white flex items-center justify-between">
                        <span>👤 Security Manager</span>
                        <span className="font-mono text-[9px] text-slate-400">Alert dispatch</span>
                      </div>

                      <div className="h-3 w-[1.5px] bg-slate-800 mx-auto" />

                      {/* Employee Endpoint */}
                      <div className="p-2 bg-red-950/15 border border-red-500/20 rounded-lg text-xs font-semibold text-red-300 flex items-center justify-between">
                        <span>💻 Endpoint #8291 (Blocked)</span>
                        <span className="font-mono text-[9px] text-red-400 font-bold">Safe</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FRAME 8: Analytics Graphs */}
              {currentFrame === 8 && (
                <div className="w-full h-full flex flex-col items-center justify-center animate-fadeIn">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 w-full max-w-sm shadow-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                      <span className="font-sans text-xs font-bold text-white">Shield Telemetry Analytics</span>
                      <span className="font-mono text-[9px] text-slate-400">LIVE AUTO UPDATES</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-left">
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-850">
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Scam Blocks</span>
                        <strong className="text-xl font-mono text-blue-400">1,248</strong>
                      </div>
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-850">
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Data Leaks</span>
                        <strong className="text-xl font-mono text-emerald-400">0 Bytes</strong>
                      </div>
                    </div>

                    {/* Simple pure inline CSS-based mock line-graph */}
                    <div className="h-20 bg-slate-900 rounded-lg border border-slate-850 p-2 flex items-end justify-between relative overflow-hidden">
                      <div className="absolute top-1 right-2 font-mono text-[8px] text-emerald-500 font-bold bg-emerald-500/10 px-1 rounded">HEALTH: 100%</div>
                      <div className="w-4 h-[20%] bg-[#0A5ED6]/30 rounded-t-sm" />
                      <div className="w-4 h-[35%] bg-[#0A5ED6]/45 rounded-t-sm" />
                      <div className="w-4 h-[25%] bg-[#0A5ED6]/30 rounded-t-sm" />
                      <div className="w-4 h-[60%] bg-[#0A5ED6]/60 rounded-t-sm animate-pulse" />
                      <div className="w-4 h-[45%] bg-[#0A5ED6]/45 rounded-t-sm" />
                      <div className="w-4 h-[85%] bg-[#0A5ED6]/80 rounded-t-sm" />
                      <div className="w-4 h-[100%] bg-blue-500 rounded-t-sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* FRAME 9: Outro Brand Logo */}
              {currentFrame === 9 && (
                <div className="w-full h-full flex flex-col items-center justify-center animate-fadeIn space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-[#0A5ED6]/15 flex items-center justify-center text-[#0A5ED6] border border-[#0A5ED6]/40 shadow-lg animate-pulse">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="24" height="24" rx="6" fill="#0F172A"/>
                        <path d="M12 5.5L6.5 7.5V11.5C6.5 14.85 8.85 17.95 12 18.5C15.15 17.95 17.5 14.85 17.5 11.5V7.5L12 5.5Z" fill="#0A5ED6"/>
                        <path d="M11.5 8H12.5V14.5H11.5V8ZM12 16C11.5 16 11.25 15.75 11.25 15.25C11.25 14.75 11.5 14.5 12 14.5C12.5 14.5 12.75 14.75 12.75 15.25C12.75 15.75 12.5 16 12 16Z" fill="white"/>
                      </svg>
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <h3 className="font-sans font-black text-2xl text-white tracking-tight">AegisOne</h3>
                    <p className="font-sans text-xs text-slate-400 font-medium">Sovereign Link Protection for SMEs</p>
                  </div>

                  <div className="bg-[#0A5ED6]/10 border border-[#0A5ED6]/20 rounded-xl px-4 py-2 font-mono text-[10px] text-blue-300">
                    Secure. Protect. Prevent. • 100% Air-Gapped Local Control
                  </div>
                </div>
              )}

            </div>

            {/* Video Controls Footer Panel */}
            <div className="border-t border-slate-800/80 pt-4 mt-2">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Control Actions */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-10 h-10 rounded-full bg-[#0A5ED6] hover:bg-blue-600 text-white flex items-center justify-center transition-colors shadow-lg cursor-pointer"
                    title={isPlaying ? "Pause tour" : "Start automated walkthrough"}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <button 
                    onClick={() => {
                      setCurrentFrame(0);
                      setIsPlaying(true);
                      onShowNotification("Walkthrough restarted from initial state.");
                    }}
                    className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    title="Restart explainer walkthrough"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  <div className="text-left hidden sm:block">
                    <div className="font-sans text-xs font-bold text-white">{frames[currentFrame].title}</div>
                    <div className="font-mono text-[9px] text-slate-500 uppercase tracking-wider">Visual Explainer Step {currentFrame + 1} of 10</div>
                  </div>
                </div>

                {/* Progress bar ticks */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {frames.map((frame) => (
                    <button
                      key={frame.id}
                      onClick={() => handleFrameSelect(frame.id)}
                      className={`w-5 h-2 rounded-[2px] transition-all cursor-pointer ${
                        currentFrame === frame.id 
                          ? 'bg-[#0A5ED6] w-8' 
                          : 'bg-slate-800 hover:bg-slate-750'
                      }`}
                      title={`Jump to ${frame.timeRange}`}
                    />
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Right Side: Visual Flowchart list and AI video prompt generator (5 columns) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            
            {/* Step Description Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left space-y-3 shadow-xl">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                {React.createElement(frames[currentFrame].icon, { className: "w-5 h-5 text-blue-400" })}
                <div>
                  <span className="font-mono text-[9px] text-[#0A5ED6] block tracking-widest font-bold uppercase">Active Segment Details</span>
                  <h3 className="font-sans font-bold text-sm text-white">{frames[currentFrame].title}</h3>
                </div>
              </div>
              <p className="font-sans text-xs text-slate-400 leading-relaxed">
                {frames[currentFrame].desc}
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850/80 text-[11px] leading-relaxed font-mono text-slate-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#0A5ED6] rounded-full shrink-0" />
                <span>Simulated deployment context matches local air-gapped node requirements perfectly.</span>
              </div>
            </div>

            {/* AI Video Generator Prompt Copy Box */}
            <div className="bg-slate-900 border border-[#0A5ED6]/25 rounded-2xl p-6 text-left space-y-4 shadow-xl">
              <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                <Sparkles className="w-4.5 h-4.5 text-amber-400" />
                <div>
                  <span className="font-mono text-[9px] text-amber-400 block tracking-wider font-bold uppercase font-semibold">Render high-fidelity 3D Explainer</span>
                  <h3 className="font-sans font-bold text-sm text-white">AI Video Generator Prompt</h3>
                </div>
              </div>
              
              <p className="font-sans text-xs text-slate-400 leading-relaxed">
                Want to generate the physical 3D video file yourself? Copy our pre-configured cinematic storyboard prompt to paste into AI tools like Sora, Kling AI, or Runway Gen-3.
              </p>

              {/* Collapsed prompt view */}
              <div className="relative bg-slate-950 rounded-xl p-3 border border-slate-850 font-mono text-[10px] text-slate-300 max-h-32 overflow-y-auto leading-relaxed scrollbar-thin">
                {`Symmetric cinematic 3D explainer video for cyber security product "AegisOne". Smooth 24fps, high-contrast professional corporate cyber defense style.
0:00-0:02: Camera pans up to a modern sleek concrete and glass corporate office headquarters. A holographic blue shield with the name "AegisOne" glows above the entrance.
0:02-0:04: Smooth x-ray camera transition inside the building, showing three floors with employees: HR Department on top, Finance Department in middle, Sales Department on bottom, working in clean, modern, well-lit spaces.`}
              </div>

              {/* Action Trigger Button */}
              <button
                onClick={handleCopyPrompt}
                className="font-sans w-full text-center text-xs font-bold bg-[#0A5ED6] hover:bg-blue-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400 animate-scaleIn" /> : <Copy className="w-4 h-4" />}
                {copied ? 'AI Prompt Copied to Clipboard!' : 'Copy AI Video Generator Prompt'}
              </button>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
