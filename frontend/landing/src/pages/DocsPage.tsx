import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import {
  ShieldCheck, Code2, Rocket, BookOpen, ChevronRight,
  Copy, Check, Globe, FileText, Paperclip, Activity,
  Lock, Database, Server, Zap, ArrowRight, Menu, X
} from 'lucide-react';

/* ─── SEO meta helper ─────────────────────────────────────────────────── */
function useSEO({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
    meta.content = description;

    let og = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (!og) { og = document.createElement('meta'); og.setAttribute('property', 'og:title'); document.head.appendChild(og); }
    og.content = title;

    let ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (!ogDesc) { ogDesc = document.createElement('meta'); ogDesc.setAttribute('property', 'og:description'); document.head.appendChild(ogDesc); }
    ogDesc.content = description;
  }, [title, description]);
}

/* ─── Shared UI atoms (Light Theme) ────────────────────────────────────── */
function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-200 my-5 shadow-sm">
      <div className="flex items-center justify-between bg-zinc-100 px-4 py-2.5 border-b border-zinc-200">
        <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider">{language}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="bg-white text-zinc-800 font-mono text-xs leading-relaxed p-4 overflow-x-auto whitespace-pre-wrap">{code}</pre>
    </div>
  );
}

function Pill({ color, children }: { color: 'blue' | 'green' | 'amber' | 'red' | 'purple'; children: React.ReactNode }) {
  const p = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${p[color]}`}>{children}</span>;
}

function FeatureCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 rounded-xl bg-white border border-zinc-200 hover:border-[#4e54c8]/40 hover:shadow-md transition-all duration-300">
      <div className="text-[#8f94fb] shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="font-semibold text-zinc-900 text-sm mb-1">{title}</p>
        <p className="text-xs text-zinc-600 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: 'GET' | 'POST' | 'DELETE' | 'PUT'; path: string; desc: string }) {
  const c = { GET: 'bg-blue-100 text-blue-700', POST: 'bg-emerald-100 text-emerald-700', DELETE: 'bg-red-100 text-red-700', PUT: 'bg-amber-100 text-amber-700' };
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:border-zinc-300 transition-colors">
      <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded shrink-0 mt-0.5 ${c[method]}`}>{method}</span>
      <div><code className="text-sm font-mono text-zinc-900">{path}</code><p className="text-[11px] text-zinc-500 mt-0.5">{desc}</p></div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-bold text-zinc-900 mb-2 font-headings">{children}</h2>;
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-600 leading-relaxed max-w-2xl text-sm mb-8">{children}</p>;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      {children}
    </div>
  );
}

/* ─── Content blocks ──────────────────────────────────────────────────── */

function OverviewSection() {
  return (
    <div id="overview" className="scroll-mt-32 space-y-10">
      <div>
        <SectionTitle>What is AegisOne?</SectionTitle>
        <SubTitle>
          AegisOne is a <strong className="text-zinc-900">sovereign security platform</strong> that runs entirely inside your own office hardware or private cloud VPC.
          No data ever leaves your network. It blocks phishing links, scam emails, and malicious attachments in under 100ms — before your employees ever see them.
        </SubTitle>
        <div className="grid sm:grid-cols-2 gap-4">
          <FeatureCard icon={<Lock size={16} />} title="Zero data exfiltration">All scanning happens on your own server. AegisOne never receives your URLs, email content, or user data.</FeatureCard>
          <FeatureCard icon={<Zap size={16} />} title="Under 100ms verdicts">Running locally means zero cloud round-trips. Links are scanned and blocked in under 100 ms — no user-visible delay.</FeatureCard>
          <FeatureCard icon={<Database size={16} />} title="Your logs, your keys">All threat logs go to your own PostgreSQL database. You control the encryption keys — not us.</FeatureCard>
          <FeatureCard icon={<Server size={16} />} title="Runs anywhere">Same Docker image works on a local office PC, bare-metal server, AWS VPC, or Google Cloud. One image, any environment.</FeatureCard>
        </div>
      </div>

      <div>
        <SectionTitle>How it works</SectionTitle>
        <SubTitle>Four simple steps — all happening on your hardware, in real-time.</SubTitle>
        <div className="space-y-3">
          {[
            { n: '01', t: 'Employee clicks a link', d: 'The AegisOne browser extension intercepts the navigation request before the page loads in Chrome, Firefox, or Edge.' },
            { n: '02', t: 'Local node scans it in parallel', d: 'Domain reputation, URL structure analysis, AI content classification, and visual phishing template matching — all run simultaneously on your private node.' },
            { n: '03', t: 'Verdict returned in under 100ms', d: 'SAFE loads normally. SUSPICIOUS shows a warning. BLOCKED never opens. Every result is written to your local audit log.' },
            { n: '04', t: 'SOC dashboard updated live', d: 'Your security team sees every threat event in real-time via your dashboard. Nothing passes through an external service.' },
          ].map(({ n, t, d }) => (
            <div key={n} className="flex gap-4 items-start p-4 rounded-xl border border-zinc-200 bg-white hover:border-[#4e54c8]/40 hover:shadow-sm transition-all duration-300">
              <span className="text-2xl font-bold text-gradient bg-clip-text text-transparent shrink-0 font-headings">{n}</span>
              <div><p className="font-semibold text-zinc-900 text-sm">{t}</p><p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{d}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Supported platforms</SectionTitle>
        <SubTitle>AegisOne runs on any platform that supports Docker 24+.</SubTitle>
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-700 font-semibold text-xs border-b border-zinc-200">
              <tr><th className="text-left px-4 py-3">Platform</th><th className="text-left px-4 py-3">Min. specs</th><th className="text-left px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs bg-white">
              {[
                ['Windows Server 2019+', '4 vCPU / 8 GB RAM', 'green', 'Stable'],
                ['Ubuntu 20.04 / 22.04', '2 vCPU / 4 GB RAM', 'green', 'Stable'],
                ['AWS EC2 (t3.medium+)', '2 vCPU / 4 GB RAM', 'green', 'Stable'],
                ['Google Cloud VPC', '2 vCPU / 4 GB RAM', 'green', 'Stable'],
                ['macOS (Docker Desktop)', '4 vCPU / 8 GB RAM', 'amber', 'Beta'],
              ].map(([p, r, c, s]) => (
                <tr key={p} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-zinc-800">{p}</td>
                  <td className="px-4 py-3 text-zinc-600">{r}</td>
                  <td className="px-4 py-3"><Pill color={c as any}>{s}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SecuritySection() {
  return (
    <div id="security" className="scroll-mt-32 space-y-10 pt-10 border-t border-zinc-200">
      <div>
        <SectionTitle>Security Features</SectionTitle>
        <SubTitle>
          AegisOne runs four detection engines in parallel. Each catches a different class of threat.
          Together they cover phishing sites, social engineering emails, and malicious file attachments.
        </SubTitle>
      </div>

      {/* URL Scanner */}
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border border-[#4e54c8]/20 bg-[#4e54c8]/5 flex items-center justify-center"><Globe size={16} className="text-[#8f94fb]" /></div>
          <h3 className="text-xl font-bold text-zinc-900 font-headings">URL Scanner</h3>
        </div>
        <p className="text-sm text-zinc-600 leading-relaxed">Every link an employee clicks passes through a 4-stage pipeline before the page loads — completing in under 100ms.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { t: 'Domain reputation check', d: 'Checks against 4.2M+ known malicious domains in the local threat database. Instant BLOCKED verdict for known bad actors.' },
            { t: 'Structural URL analysis', d: 'Detects homoglyph characters (е vs e), IP-based hosts, suspicious subdomains, misleading TLDs, and encoded payloads.' },
            { t: 'AI content analysis', d: 'Fetches page HTML with a hardened headless browser and runs it through a fine-tuned NLP classifier for phishing indicators.' },
            { t: 'Visual fingerprint match', d: 'Renders page screenshots and compares against 800+ known phishing templates using perceptual hashing + CNN similarity.' },
          ].map(({ t, d }) => (
            <div key={t} className="p-4 rounded-xl border border-zinc-200 bg-white hover:border-[#4e54c8]/40 hover:shadow-sm transition-all duration-300">
              <p className="text-sm font-semibold text-zinc-900 mb-1.5">{t}</p>
              <p className="text-xs text-zinc-600 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: 'SAFE', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', d: 'Score < 30. Link loads normally.' },
            { v: 'SUSPICIOUS', color: 'text-amber-700 bg-amber-50 border-amber-200', d: 'Score 30–70. Warning interstitial shown.' },
            { v: 'BLOCKED', color: 'text-red-700 bg-red-50 border-red-200', d: 'Score > 70. Page never opens. Incident logged.' },
          ].map(({ v, color, d }) => (
            <div key={v} className={`p-3.5 rounded-xl border ${color}`}>
              <p className="font-mono font-bold text-sm mb-1">{v}</p>
              <p className="text-[11px] leading-relaxed opacity-90">{d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-100" />

      {/* Content Scanner */}
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border border-[#4e54c8]/20 bg-[#4e54c8]/5 flex items-center justify-center"><FileText size={16} className="text-[#8f94fb]" /></div>
          <h3 className="text-xl font-bold text-zinc-900 font-headings">Content Scanner</h3>
        </div>
        <p className="text-sm text-zinc-600 leading-relaxed">Analyses email body text for social engineering patterns using a model trained on 2.3 million phishing and legitimate email samples. Integrates via SMTP milter — adding less than 80ms to email delivery.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { t: 'Urgency language', d: '"Your account will be suspended in 24 hours" — detected and flagged automatically.' },
            { t: 'Authority impersonation', d: 'Fake FBR, State Bank, Microsoft, or bank identities requesting immediate action.' },
            { t: 'Credential harvesting', d: 'Forms asking for passwords, OTPs, or national IDs in unexpected contexts.' },
          ].map(({ t, d }) => (
            <div key={t} className="p-4 rounded-xl border border-zinc-200 bg-white hover:border-[#4e54c8]/40 hover:shadow-sm transition-all duration-300">
              <p className="text-sm font-semibold text-zinc-900 mb-1.5">{t}</p>
              <p className="text-xs text-zinc-600 italic leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-100" />

      {/* Attachment Scanner */}
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border border-[#4e54c8]/20 bg-[#4e54c8]/5 flex items-center justify-center"><Paperclip size={16} className="text-[#8f94fb]" /></div>
          <h3 className="text-xl font-bold text-zinc-900 font-headings">Attachment Scanner</h3>
        </div>
        <p className="text-sm text-zinc-600 leading-relaxed">Deep inspection of email attachments for embedded threats. Supports PDF (incl. embedded JS), DOCX macros, XLSX formula injection, ZIP/RAR (3-level recursive), EXE/DLL, HTML, and SVG.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { t: 'Static YARA analysis', d: 'Parses file structure and checks against 3,200+ YARA rules for known malware signatures and macro code.' },
            { t: 'Dynamic sandboxing', d: 'High-risk files are detonated inside an isolated Docker-in-Docker container. Behavioral outputs are scored.' },
            { t: 'Entropy detection', d: 'Packed or encrypted payloads have high byte randomness. AegisOne flags files above the entropy threshold.' },
            { t: 'Hash reputation', d: 'SHA-256 of every file checked against 12M+ known-bad hashes from MalwareBazaar, VirusTotal, and CIRCL.' },
          ].map(({ t, d }) => (
            <div key={t} className="p-4 rounded-xl border border-zinc-200 bg-white hover:border-[#4e54c8]/40 hover:shadow-sm transition-all duration-300">
              <p className="text-sm font-semibold text-zinc-900 mb-1.5">{t}</p>
              <p className="text-xs text-zinc-600 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-100" />

      {/* Live Telemetry */}
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border border-[#4e54c8]/20 bg-[#4e54c8]/5 flex items-center justify-center"><Activity size={16} className="text-[#8f94fb]" /></div>
          <h3 className="text-xl font-bold text-zinc-900 font-headings">Live Telemetry</h3>
        </div>
        <p className="text-sm text-zinc-600 leading-relaxed">Every threat event streams in real-time over Redis Streams. Your SOC team sees threats as they happen — no polling, no delay. Forward to any SIEM via webhook or native Elastic/Splunk plugins.</p>
        <div className="space-y-2">
          {[
            { e: 'url.blocked', c: 'red' as const, d: 'Fires when a URL receives a BLOCKED verdict. Triggers an immediate SOC alert.' },
            { e: 'email.flagged', c: 'amber' as const, d: 'Fires when an inbound email receives a non-SAFE content scanner verdict.' },
            { e: 'attachment.blocked', c: 'red' as const, d: 'Fires when a scanned file is quarantined after attachment analysis.' },
            { e: 'node.health', c: 'green' as const, d: 'Emitted every 30s — CPU, RAM, queue depth, threat model version.' },
          ].map(({ e, c, d }) => (
            <div key={e} className="flex items-start gap-3 p-3.5 rounded-lg border border-zinc-200 bg-white">
              <Pill color={c}>{e}</Pill>
              <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ApiSection() {
  return (
    <div id="api" className="scroll-mt-32 space-y-10 pt-10 border-t border-zinc-200">
      <div>
        <SectionTitle>API Reference</SectionTitle>
        <SubTitle>
          Integrate AegisOne scanning directly into your own apps and automation pipelines.
          All endpoints run on your local node — no external server ever involved.
        </SubTitle>
      </div>

      <Block title="Authentication">
        <p className="text-sm text-zinc-600 mb-3">Include your API key in the <code className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-800">Authorization</code> header. Generate keys under <span className="text-zinc-900 font-medium">Settings → API Keys</span> in the admin dashboard.</p>
        <CodeBlock language="bash" code={`curl -X POST http://localhost:7357/v1/scan/url \\
  -H "Authorization: Bearer ae1_sk_live_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}'`} />
      </Block>

      <Block title="Base URL">
        <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 font-mono text-sm text-emerald-700 mb-1.5">
          {'http://<YOUR_NODE_IP>:7357/v1'}
        </div>
        <p className="text-xs text-zinc-500">Change the port under <code className="bg-zinc-100 border border-zinc-200 px-1 rounded font-mono text-[11px] text-zinc-800">server.port</code> in <code className="bg-zinc-100 border border-zinc-200 px-1 rounded font-mono text-[11px] text-zinc-800">aegisone.yml</code></p>
      </Block>

      <Block title="Endpoints">
        <div className="space-y-2">
          <Endpoint method="POST" path="/v1/scan/url" desc="Submit a URL for scanning. Returns verdict, score, reasons synchronously." />
          <Endpoint method="POST" path="/v1/scan/content" desc="Analyse raw email body text for social engineering patterns." />
          <Endpoint method="POST" path="/v1/scan/attachment" desc="Scan a file (multipart/form-data). Returns verdict and quarantine ID if blocked." />
          <Endpoint method="GET"  path="/v1/incidents" desc="List recent incidents. Filter by ?limit, ?from, ?verdict." />
          <Endpoint method="GET"  path="/v1/incidents/{id}" desc="Fetch full details for a single incident including evidence and timeline." />
          <Endpoint method="DELETE" path="/v1/quarantine/{hash}" desc="Release or permanently delete a quarantined file by SHA-256 hash." />
          <Endpoint method="GET"  path="/v1/node/health" desc="Node health: version, uptime, CPU, RAM, queue depth." />
        </div>
      </Block>

      <Block title="Example: Scan a URL">
        <CodeBlock language="json" code={`// POST /v1/scan/url
{
  "url": "https://suspicious-site.xyz/login",
  "context": "email",
  "user_id": "emp_7821"
}

// 200 OK — response
{
  "verdict": "BLOCKED",
  "threat_score": 87,
  "reasons": ["known_phishing_template", "domain_age_3_days"],
  "processing_time_ms": 54,
  "incident_id": "INC-2026-07891"
}`} />
      </Block>

      <Block title="Rate limits by plan">
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
              <tr><th className="text-left px-4 py-3">Plan</th><th className="text-left px-4 py-3">URL scans / min</th><th className="text-left px-4 py-3">File scans / min</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {[['Starter (≤50 users)', '500', '50'], ['Growth (≤200 users)', '2,000', '200'], ['Enterprise (unlimited)', 'Unlimited', 'Unlimited']].map(([t, u, f]) => (
                <tr key={t} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-zinc-900">{t}</td>
                  <td className="px-4 py-3 text-zinc-600 font-mono">{u}</td>
                  <td className="px-4 py-3 text-zinc-600 font-mono">{f}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block title="Error codes">
        <div className="space-y-1.5">
          {[
            ['400', 'Bad Request — missing or malformed request body'],
            ['401', 'Unauthorized — API key missing or invalid'],
            ['403', 'Forbidden — key lacks required scope for this endpoint'],
            ['429', 'Rate limit exceeded — retry after X-RateLimit-Reset'],
            ['503', 'Service unavailable — scanner queue at capacity, check node health'],
          ].map(([c, d]) => (
            <div key={c} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 bg-zinc-50">
              <span className="font-mono font-bold text-xs text-red-600 w-8 shrink-0">{c}</span>
              <span className="text-xs text-zinc-600">{d}</span>
            </div>
          ))}
        </div>
      </Block>
    </div>
  );
}

function DeploySection() {
  return (
    <div id="deploy" className="scroll-mt-32 space-y-10 pt-10 border-t border-zinc-200">
      <div>
        <SectionTitle>Deployment Guide</SectionTitle>
        <SubTitle>
          AegisOne ships as a single Docker container. You can be up and scanning in under 15 minutes on any Linux machine, Windows Server, or private cloud VPC.
        </SubTitle>
      </div>

      <Block title="Prerequisites">
        <ul className="space-y-2 text-sm text-zinc-600">
          {[
            'Docker Engine 24+ (or Docker Desktop on Windows/Mac)',
            'PostgreSQL 14+ — can run in the same Docker Compose stack',
            'AegisOne license key — email us at araza2125012.pgc@gmail.com to get one',
            'Outbound HTTPS to update.aegisone.io for daily threat feed delta patches',
          ].map(r => <li key={r} className="flex gap-2"><span className="text-[#8f94fb] shrink-0">→</span>{r}</li>)}
        </ul>
      </Block>

      <Block title="Step 1 — Create your config file">
        <CodeBlock language="yaml" code={`# /etc/aegisone/aegisone.yml
server:
  port: 7357
  host: "0.0.0.0"

license_key: "ae1_lic_xxxxxxxxxxxx"

database:
  host: "localhost"
  port: 5432
  name: "aegisone"
  user: "aegis"
  password: "your_secure_password"

scanner:
  safe_threshold: 30
  block_threshold: 70
  live_fetch: true
  visual_match: true
  whitelist:
    - "*.yourcompany.local"
    - "intranet.yourcompany.com"`} />
      </Block>

      <Block title="Step 2 — Start with Docker Compose">
        <CodeBlock language="yaml" code={`# docker-compose.yml
version: "3.9"
services:
  aegisone:
    image: aegisone/node:latest
    ports:
      - "7357:7357"
    volumes:
      - /etc/aegisone:/config
      - /var/aegisone/quarantine:/quarantine
    environment:
      - CONFIG_PATH=/config/aegisone.yml
    restart: unless-stopped
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: aegisone
      POSTGRES_USER: aegis
      POSTGRES_PASSWORD: your_secure_password
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:`} />
      </Block>

      <Block title="Step 3 — Start and verify">
        <CodeBlock language="bash" code={`# Start the stack
docker compose up -d

# Verify node is healthy
curl http://localhost:7357/v1/node/health

# Expected response:
# {
#   "status": "ok",
#   "version": "2.1.0",
#   "uptime_s": 12,
#   "queue_depth": 0,
#   "threat_db_version": "2026-07-23"
# }`} />
      </Block>

      <Block title="Step 4 — Install the browser extension">
        <p className="text-sm text-zinc-600 mb-4">Point the extension to your node's local IP once. After that, every link every employee clicks is automatically protected — with zero behaviour change required from your staff.</p>
        <div className="flex flex-wrap gap-3">
          {[
            ['Chrome Extension', 'bg-blue-50 text-blue-700 border-blue-200'],
            ['Firefox Extension', 'bg-orange-50 text-orange-700 border-orange-200'],
            ['Edge Extension', 'bg-teal-50 text-teal-700 border-teal-200'],
          ].map(([b, c]) => (
            <div key={b} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-semibold cursor-default ${c}`}>
              {b} <ArrowRight size={11} />
            </div>
          ))}
        </div>
      </Block>

      <div className="p-6 rounded-2xl border border-[#4e54c8]/20 bg-[#4e54c8]/5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#4e54c8]/20 flex items-center justify-center shrink-0"><Rocket size={18} className="text-[#8f94fb]" /></div>
          <div>
            <p className="font-semibold text-zinc-900 mb-1">Need help deploying?</p>
            <p className="text-sm text-zinc-600 mb-3">We offer free guided setup calls for new customers. We'll have you live and scanning in a single session.</p>
            <a
              href="mailto:araza2125012.pgc@gmail.com?subject=AegisOne Setup Call Request"
              className="inline-flex items-center gap-2 text-xs font-bold text-white bg-gradient-to-r from-[#8f94fb] to-[#4e54c8] px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              Request a setup call <ArrowRight size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sidebar nav config ──────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview',          icon: <BookOpen size={15} /> },
  { id: 'security', label: 'Security Features', icon: <ShieldCheck size={15} /> },
  { id: 'api',      label: 'API Reference',     icon: <Code2 size={15} /> },
  { id: 'deploy',   label: 'Deployment',        icon: <Rocket size={15} /> },
];

/* ─── Main component ──────────────────────────────────────────────────── */
export default function DocsPage() {
  const { hash } = useLocation();
  const [active, setActive] = useState('overview');

  useSEO({
    title: 'AegisOne Docs | Platform Documentation',
    description: 'Complete documentation for AegisOne. Deployment, API references, and security feature overviews.',
  });

  // Handle hash scrolling on load or change
  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        setActive(id);
      }
    }
  }, [hash]);

  // Set up intersection observer for scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -80% 0px' }
    );

    NAV_ITEMS.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const handleNav = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      window.history.pushState(null, '', `#${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900">
      <SiteHeader />

      {/* Hero banner (Light theme) */}
      <section className="pt-28 pb-12 px-5 bg-zinc-50 border-b border-zinc-200 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(78,84,200,0.05) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto relative text-center flex flex-col items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 text-xs rounded-full border border-[#4e54c8]/20 bg-[#4e54c8]/5 text-[#8f94fb] font-medium">
              <BookOpen size={12} /> Documentation
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            style={{ fontSize: '2.5rem', lineHeight: '1.1', marginBottom: '0.75rem', fontWeight: 800 }}
            className="font-headings"
          >
            AegisOne <span className="text-gradient bg-clip-text text-transparent">Docs</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="text-zinc-600 max-w-xl text-sm leading-relaxed"
          >
            Everything you need to deploy, configure, and integrate AegisOne — written in plain language, no jargon.
          </motion.p>
        </div>
      </section>

      {/* Main Content Layout with Sidebar */}
      <div className="max-w-6xl mx-auto px-5 py-12 flex flex-col md:flex-row gap-10">
        
        {/* Sticky Sidebar */}
        <aside className="md:w-64 shrink-0 hidden md:block">
          <div className="sticky top-28 space-y-1 border-l border-zinc-200 pl-4 py-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active === item.id
                    ? 'bg-[#4e54c8]/5 text-[#4e54c8]'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                <span className={active === item.id ? 'text-[#8f94fb]' : 'text-zinc-400'}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Mobile Sticky Nav */}
        <div className="md:hidden sticky top-16 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200 py-3 -mx-5 px-5 flex gap-2 overflow-x-auto hide-scrollbar">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active === item.id
                    ? 'bg-[#4e54c8] text-white'
                    : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {item.icon} {item.label}
              </button>
            ))}
        </div>

        {/* Content Sections */}
        <main className="flex-1 space-y-20 pb-20">
          <OverviewSection />
          <SecuritySection />
          <ApiSection />
          <DeploySection />
        </main>

      </div>

      <SiteFooter />
    </div>
  );
}
