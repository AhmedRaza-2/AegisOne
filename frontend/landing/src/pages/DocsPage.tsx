import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { BookOpen, ArrowRight, ShieldCheck, Server, MessageCircle } from 'lucide-react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { PRICING_PLANS } from '../config/pricingConfig';

const sections = [
  ['assistant-overview', 'What is AegisOne?'], ['assistant-features', 'Product capabilities'],
  ['assistant-pricing', 'Plans and prices'], ['assistant-deployment', 'Deployment'],
  ['assistant-organization', 'Organization details'], ['assistant-structure', 'Departments and employees'],
  ['assistant-validation', 'Validation'], ['assistant-security', 'SMTP configuration'],
  ['assistant-rollout', 'Provisioning and rollout'], ['assistant-privacy', 'Assistant privacy'],
  ['assistant-limitations', 'Limits and team support'],
] as const;

function GuideSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-28 border-b border-slate-200 pb-9 mb-9 last:border-0">
    <h2 className="text-xl sm:text-2xl font-bold text-[#0A1931] mb-4">{title}</h2>
    <div className="text-sm leading-7 text-slate-600 space-y-4">{children}</div>
  </section>;
}

export default function DocsPage() {
  const { hash } = useLocation();
  useEffect(() => {
    const previous = document.title;
    document.title = 'AegisOne | Product and setup guide';
    return () => { document.title = previous; };
  }, []);
  useEffect(() => {
    const legacy: Record<string, string> = { overview: 'assistant-overview', security: 'assistant-features', api: 'assistant-api', deploy: 'assistant-deployment' };
    const id = legacy[hash.slice(1)] || hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [hash]);
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  return <div className="min-h-screen bg-[#F8FAFC] text-[#0A1931]">
    <SiteHeader />
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-32 pb-16">
      <div className="max-w-3xl mb-10">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#0A5ED6] mb-4"><BookOpen size={16} /> AegisOne documentation</span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Understand AegisOne. Set up with confidence.</h1>
        <p className="text-slate-600 leading-7">Explore the product, compare the published plans, or follow deployment and organization setup. The chatbot on the homepage links to this guide when explaining a feature or suggesting a next step.</p>
      </div>
      <div className="grid lg:grid-cols-[230px_minmax(0,1fr)] gap-10 lg:gap-14">
        <nav aria-label="Guide sections" className="lg:sticky lg:top-28 lg:self-start rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">In this guide</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-1">{sections.map(([id, title]) => <a key={id} href={`#${id}`} className="text-sm px-2 py-1.5 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-[#0A5ED6] focus-visible:outline-2 focus-visible:outline-blue-500">{title}</a>)}</div>
        </nav>
        <article className="min-w-0 bg-white border border-slate-200 rounded-2xl p-6 sm:p-9">
          <GuideSection id="assistant-overview" title="What is AegisOne?">
            <p>AegisOne helps organizations detect phishing in links, text, emails, images and supported documents. It combines a browser extension, specialized detection models, and dashboards for employees, supervisors and administrators.</p>
            <p>Your organization deploys detection services on its own server or private infrastructure. The optional homepage chatbot is a separate service for product and setup guidance, with its own data processing described below. Registration, the deployment portal and customer dashboards have no chatbot.</p>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 flex gap-3"><ShieldCheck size={20} className="text-blue-600 shrink-0 mt-1" /><p>Detection can make mistakes. Review suspicious results and keep other security controls and staff training in place.</p></div>
          </GuideSection>
          <GuideSection id="assistant-features" title="Product capabilities">
            <ul className="list-disc ps-5 space-y-2"><li>URL and text analysis for phishing patterns and social engineering signals.</li><li>Email, image and supported attachment analysis through the available scanners and browser integrations.</li><li>A browser extension that connects to your organization’s AegisOne service.</li><li>Role-based dashboards for detections, reports and team activity.</li><li>Explanations that help users understand why content was flagged.</li></ul>
            <p>Availability depends on deployment and configuration. Ask the team to confirm specific file types, browser compatibility, integrations and commercial commitments.</p>
            <a href="/#demo" className="inline-flex items-center gap-2 font-semibold text-[#0A5ED6]">Try the interactive product preview <ArrowRight size={15} /></a>
          </GuideSection>
          <GuideSection id="assistant-pricing" title="Plans and prices">
            <p>Published website prices are in US dollars. Annual prices are the total billed for a year.</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm text-left">
              <caption className="sr-only">Published AegisOne subscription plans</caption>
              <thead className="bg-slate-50 text-slate-700"><tr><th scope="col" className="p-3">Plan</th><th scope="col" className="p-3">Employees</th><th scope="col" className="p-3">Monthly</th><th scope="col" className="p-3">Per year</th></tr></thead>
              <tbody className="divide-y divide-slate-200">{PRICING_PLANS.map(plan => <tr key={plan.id}><th scope="row" className="p-3 font-semibold text-slate-800">{plan.name}</th><td className="p-3 whitespace-nowrap">{plan.id === 'enterprise' ? '1,001+' : `${plan.minEmployees.toLocaleString('en-US')}–${plan.maxEmployees.toLocaleString('en-US')}`}</td><td className="p-3">{money(plan.monthlyPrice)}</td><td className="p-3">{money(plan.annualPrice)}</td></tr>)}</tbody>
            </table></div>
            <p>The assistant can compare plans using your approximate team size. Confirm custom terms, support commitments, endpoint allowances and required integrations with the team before purchase.</p>
            <Link to="/register" className="inline-flex items-center gap-2 font-semibold text-[#0A5ED6]">Register your organization <ArrowRight size={15} /></Link>
          </GuideSection>
          <GuideSection id="assistant-deployment" title="Deploy your organization’s services">
            <ol className="list-decimal ps-5 space-y-2"><li>Register your organization and complete account confirmation.</li><li>Open the deployment portal. Wait for approval if your application needs review.</li><li>Install and start Docker on the machine hosting AegisOne.</li><li>Follow the portal’s operating-system-specific instructions. Run its deployment command on the server machine.</li><li>Check service readiness, then open the setup dashboard.</li></ol>
            <p>The current deployment includes PostgreSQL, a FastAPI backend and a Next.js dashboard. Standard backend and dashboard ports are 8000 and 3002. Network access, firewall rules and configuration must fit your environment.</p>
            <p>Running containers do not prove the application is ready. First startup may take longer while services initialize. An HTTPS portal may be unable to check an HTTP server on a remote private network. An unknown check is not a successful check.</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex gap-3"><Server size={20} className="shrink-0 mt-1 text-slate-500" /><p>Keep deployment keys and generated commands private. Inspect container health and connectivity in your local terminal. Do not paste commands containing credentials into chat.</p></div>
            <Link to="/portal" className="inline-flex items-center gap-2 font-semibold text-[#0A5ED6]">Open the deployment portal <ArrowRight size={15} /></Link>
          </GuideSection>
          <GuideSection id="assistant-organization" title="1. Organization details">
            <p>Complete organization information and the administrator email in the setup form. Fill required fields before continuing. Keep actual names, email addresses and personal details in the form.</p>
            <p>Use the setup form’s required-field messages before continuing. The homepage chatbot can explain these steps generally; it cannot see, highlight, fill or submit setup fields.</p>
          </GuideSection>
          <GuideSection id="assistant-structure" title="2. Departments and employees">
            <p>Create departments and add employees manually or import the downloadable CSV template. Preserve the template’s column headers and follow the examples in the setup screen.</p>
            <p>Review employee IDs, department assignments and roles after import. Keep employee files in the setup workflow; the assistant does not accept files or read imported records.</p>
          </GuideSection>
          <GuideSection id="assistant-validation" title="3. Review validation results">
            <p>Resolve duplicate employee IDs, duplicate email addresses, invalid rows and employees without a department before moving forward. Open the relevant validation group and correct records in the setup table.</p>
            <p>Review the issue counts and groups directly in the setup screen. The homepage chatbot does not receive validation results and cannot open groups, delete records, change roles or bypass setup rules.</p>
          </GuideSection>
          <GuideSection id="assistant-security" title="4. Configure SMTP email">
            <p>Enter your provider’s SMTP host, port, username, approved password and sender address in the form. Run the existing connection test yourself before rollout.</p>
            <ul className="list-disc ps-5 space-y-2"><li>Authentication errors may require checking account permissions or a provider-approved app password.</li><li>Network errors may require checking connectivity, firewall rules or the SMTP address.</li><li>TLS errors require checking the provider’s supported security settings.</li></ul>
            <p>Use your provider’s official instructions. Never send SMTP credentials, passwords, API keys or connection strings to the assistant.</p>
          </GuideSection>
          <GuideSection id="assistant-rollout" title="5. Provision accounts and review rollout">
            <p>Review provisioning and email-dispatch results before finishing. If some emails fail, inspect the failure group and use the existing retry controls.</p>
            <p>Creating an account or sending an email does not prove browser protection is active. Employees must install and connect their extension to the correct service. The assistant cannot provision accounts, test credentials or send emails.</p>
          </GuideSection>
          <GuideSection id="assistant-privacy" title="How the optional cloud assistant uses data">
            <p>Quick guides work without cloud AI. When the homepage chatbot’s API is configured, questions and the current homepage section are sent through the assistant service to Groq. Voice starts only when you choose to record and grant browser permission; microphone recordings are sent for transcription, and you review the transcript before sending it.</p>
            <p>Automatic context contains only the landing homepage and its current section. The chatbot does not observe the deployment portal, readiness checks, setup fields, validation results or rollout status. It does not capture the screen, inspect form values, read employee records or attach authentication information.</p>
            <p>The application does not retain microphone audio. Chat sessions expire after 24 hours; dedicated voice-transcription sessions expire after 15 minutes. New chat requests deletion of the current session. Leaving the homepage closes chat and stops active requests and voice; reloading clears the visible transcript.</p>
            <p>Browser or bundled basic synthetic voices read requested answers. Basic voices can sound robotic. Recording and playback stay in the homepage chatbot. Microphone access requires HTTPS or localhost; text chat remains available on remote plain-HTTP pages.</p>
            <p>Cloud assistance is separate from local detection. These statements describe application behavior and do not promise a third-party provider’s retention policy. Do not enter secrets or sensitive customer information into chat.</p>
          </GuideSection>
          <GuideSection id="assistant-limitations" title="Limits and getting help from the team">
            <p>The assistant provides guidance. It cannot run terminal commands, change setup data, register an organization, take a payment, grant permissions, send a rollout email or confirm a meeting.</p>
            <p>An assistant response is not an accuracy guarantee, compliance certification, support SLA or promise of an integration. If an answer is missing or uncertain, use the guide or ask the team.</p>
            <p>A contact-form demo request asks the team to follow up. The team must confirm availability and appointment details.</p>
            <a href="/#contact" className="inline-flex items-center gap-2 font-semibold text-[#0A5ED6]"><MessageCircle size={16} /> Contact the team or request a demo</a>
          </GuideSection>
          <section id="assistant-api" className="scroll-mt-28 text-sm text-slate-600 leading-7"><h2 className="text-xl font-bold text-[#0A1931] mb-3">API reference for your installation</h2><p>Use the API documentation served by your deployed backend for available endpoints and authentication requirements. Paths must match your installed version. Ask your administrator before integrating applications with a production node.</p></section>
        </article>
      </div>
    </main>
    <SiteFooter />
  </div>;
}
