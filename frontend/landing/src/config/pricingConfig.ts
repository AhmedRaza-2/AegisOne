export interface PricingPlan {
  id: 'starter' | 'growth' | 'enterprise';
  name: string;
  tagline: string;
  employeeRangeLabel: string;
  minEmployees: number;
  maxEmployees: number;
  apiValue: number; // Integer employee_count sent to backend
  monthlyPrice: number;
  annualPrice: number; // Discounted annual rate per year
  annualEquivalentMonthly: number; // Monthly cost when billed annually
  popular?: boolean;
  badge?: string;
  features: string[];
  ctaText: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter Shield',
    tagline: 'Ideal for small teams and emerging startups.',
    employeeRangeLabel: '1 – 100 Employees',
    minEmployees: 1,
    maxEmployees: 100,
    apiValue: 100,
    monthlyPrice: 20,
    annualPrice: 150, // ~$12.50/mo equivalent
    annualEquivalentMonthly: 12.5,
    features: [
      'Real-time AI Phishing Detection',
      'Browser Extension Deployment',
      'Up to 100 Protected Endpoints',
      'Standard Email Alerts & Telemetry',
      'Community & Knowledgebase Support',
    ],
    ctaText: 'Choose Starter',
  },
  {
    id: 'growth',
    name: 'Growth Defense',
    tagline: 'Designed for scaling organizations requiring strict compliance.',
    employeeRangeLabel: '101 – 1000 Employees',
    minEmployees: 101,
    maxEmployees: 1000,
    apiValue: 500,
    monthlyPrice: 79,
    annualPrice: 699, // ~$58.25/mo equivalent
    annualEquivalentMonthly: 58.25,
    popular: true,
    badge: 'MOST POPULAR',
    features: [
      'Everything in Starter Shield',
      'Up to 1,000 Protected Endpoints',
      'Automated Incident Remediation',
      'SIEM & Webhook Integrations',
      'Priority 24/7 Support with SLA',
    ],
    ctaText: 'Choose Growth',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Guardian',
    tagline: 'Maximum security control & dedicated cloud infrastructure.',
    employeeRangeLabel: '1000+ Employees',
    minEmployees: 1001,
    maxEmployees: 99999,
    apiValue: 1000,
    monthlyPrice: 199,
    annualPrice: 1799, // ~$149.90/mo equivalent
    annualEquivalentMonthly: 149.9,
    badge: 'ENTERPRISE GRADE',
    features: [
      'Everything in Growth Defense',
      'Unlimited Protected Endpoints',
      'Custom AI Model Fine-tuning',
      'Dedicated Private Node Deployment',
      'Dedicated Security Account Manager',
    ],
    ctaText: 'Choose Enterprise',
  },
];

/**
 * Get plan by ID safely with fallback to starter
 */
export function getPlanById(planId?: string | null): PricingPlan {
  if (!planId) return PRICING_PLANS[0];
  const found = PRICING_PLANS.find((p) => p.id === planId.toLowerCase().trim());
  return found || PRICING_PLANS[0];
}

/**
 * Validate if plan ID exists
 */
export function isValidPlan(planId?: string | null): boolean {
  if (!planId) return false;
  return PRICING_PLANS.some((p) => p.id === planId.toLowerCase().trim());
}

/**
 * Get plan based on numeric employee count
 */
export function getPlanByEmployeeCount(count: number): PricingPlan {
  const matched = PRICING_PLANS.find((p) => p.apiValue === count);
  if (matched) return matched;

  if (count <= 100) return PRICING_PLANS[0];
  if (count < 1000) return PRICING_PLANS[1];
  return PRICING_PLANS[2];
}
