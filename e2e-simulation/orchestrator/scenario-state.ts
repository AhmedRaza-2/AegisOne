/**
 * AegisOne E2E Simulation — Scenario State
 *
 * This is the SINGLE SOURCE OF TRUTH for the entire simulation run.
 * Every actor reads and writes here. The validator compares
 * `expected` vs `actual` to determine pass/fail.
 */

export type BehaviorProfile = 'risky' | 'average' | 'security_aware';

export type ActorLifecycleState = 
  | 'INITIALIZED'
  | 'PROVISIONED'
  | 'EMAIL_SENT'
  | 'EMAIL_RECEIVED'
  | 'CREDENTIAL_EXTRACTED'
  | 'LOGGED_IN'
  | 'BROWSER_ACTIVE'
  | 'URL_VISITED'
  | 'EXTENSION_INTERCEPTED'
  | 'EVENT_RECORDED'
  | 'FAILED';

export interface SimulatedEmployee {
  // Identity
  id: string;           // internal simulation ID (e2e-emp-001)
  dbUserId?: number;    // populated after provisioning
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  departmentCode: string;
  role: 'employee' | 'manager';

  // Lifecycle state tracking
  lifecycleState: ActorLifecycleState;
  lifecycleError?: string;

  // Simulation behavior
  profile: BehaviorProfile;

  // Actor type — determined from seed
  actorType: 'full_browser' | 'api_synthetic';

  // What this employee was TOLD to do (expected actions)
  expected: {
    emailReceived: boolean;
    emailOpened: boolean;
    clickedPhishingLink: boolean;
    reportedEmail: boolean;
    ignoredEmail: boolean;
    urlsVisited: string[];
    urlsSuspicious: string[];
  };

  // What actually happened in the system (populated by validators)
  actual: {
    emailDelivered?: boolean;
    websiteScansCreated?: number;
    threatsDetected?: number;
    threatReportsFiled?: number;
    securityEventsCreated?: number;
    dashboardVisible?: boolean;
  };
}

export interface SimulatedAdmin {
  email: string;
  password: string;
  dbUserId?: number;
  token?: string;
}

export interface SimulatedManager {
  email: string;
  password: string;
  departmentCode: string;
  dbUserId?: number;
  token?: string;
}

export interface CampaignEmail {
  recipientEmail: string;
  mailpitMessageId?: string;
  phishingLink: string;
  subject: string;
  deliveredAt?: string;
}

// The authoritative summary of what we expect AegisOne to have recorded
export interface ExpectedOutcomes {
  totalEmailsSent: number;
  totalEmailsDelivered: number;
  totalClicks: number;
  totalReports: number;
  totalIgnored: number;
  totalWebsiteScans: number;        // from full_browser actors
  totalSyntheticScans: number;      // from api_synthetic actors
  totalThreatsDetected: number;
  totalThreatReports: number;
}

export interface ActualOutcomes {
  websiteScansInDB: number;
  securityEventsInDB: number;
  threatReportsInDB: number;
  apiTotalScans: number;
  apiThreatsDetected: number;
  dashboardTotalScans: number;
  dashboardThreatsDetected: number;
}

export interface PhaseResult {
  phase: string;
  passed: boolean;
  durationMs: number;
  details: Record<string, unknown>;
  error?: string;
}

export class ScenarioState {
  // Configuration
  scenarioName: string;
  seed: string;
  orgId: string;
  scale: number;

  // Actors
  admin: SimulatedAdmin = { email: '', password: '' };
  managers: SimulatedManager[] = [];
  employees: SimulatedEmployee[] = [];

  // Campaign
  campaignEmails: CampaignEmail[] = [];
  campaignRunId?: string;

  // Outcomes — the heart of validation
  expected: ExpectedOutcomes = {
    totalEmailsSent: 0,
    totalEmailsDelivered: 0,
    totalClicks: 0,
    totalReports: 0,
    totalIgnored: 0,
    totalWebsiteScans: 0,
    totalSyntheticScans: 0,
    totalThreatsDetected: 0,
    totalThreatReports: 0,
  };

  actual: ActualOutcomes = {
    websiteScansInDB: 0,
    securityEventsInDB: 0,
    threatReportsInDB: 0,
    apiTotalScans: 0,
    apiThreatsDetected: 0,
    dashboardTotalScans: 0,
    dashboardThreatsDetected: 0,
  };

  // Phase tracking
  phases: PhaseResult[] = [];
  startedAt: Date = new Date();
  finishedAt?: Date;

  constructor(scenarioName: string, orgId: string, seed: string, scale: number) {
    this.scenarioName = scenarioName;
    this.orgId = orgId;
    this.seed = seed;
    this.scale = scale;
  }

  // Convenience accessors
  get fullBrowserEmployees(): SimulatedEmployee[] {
    return this.employees.filter(e => e.actorType === 'full_browser');
  }

  get syntheticEmployees(): SimulatedEmployee[] {
    return this.employees.filter(e => e.actorType === 'api_synthetic');
  }

  get totalDurationMs(): number {
    if (!this.finishedAt) return Date.now() - this.startedAt.getTime();
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }

  addPhase(result: PhaseResult): void {
    this.phases.push(result);
  }

  get passed(): boolean {
    return this.phases.every(p => p.passed);
  }

  // Compute expected outcomes from employee definitions
  // Called AFTER employees are seeded with behavior profiles
  computeExpected(): void {
    let clicks = 0, reports = 0, ignored = 0, suspiciousScans = 0;

    for (const emp of this.employees) {
      if (emp.expected.clickedPhishingLink) clicks++;
      if (emp.expected.reportedEmail) reports++;
      if (emp.expected.ignoredEmail) ignored++;
      suspiciousScans += emp.expected.urlsSuspicious.length;
    }

    // website_scans are generated by full_browser actors navigating URLs
    const browserEmployees = this.fullBrowserEmployees;
    const totalUrlsVisited = browserEmployees.reduce(
      (sum, e) => sum + e.expected.urlsVisited.length, 0
    );

    // Synthetic actors generate events via /events/ingest, not browser-based scans
    const syntheticEvents = this.syntheticEmployees.reduce(
      (sum, e) => sum + e.expected.urlsSuspicious.length, 0
    );

    this.expected = {
      totalEmailsSent: this.employees.length,
      totalEmailsDelivered: this.employees.length, // mailpit receives all
      totalClicks: clicks,
      totalReports: reports,
      totalIgnored: ignored,
      totalWebsiteScans: totalUrlsVisited,
      totalSyntheticScans: syntheticEvents,
      totalThreatsDetected: suspiciousScans + clicks,
      totalThreatReports: reports,
    };
  }

  toJSON(): object {
    return {
      scenario: this.scenarioName,
      seed: this.seed,
      orgId: this.orgId,
      scale: this.scale,
      startedAt: this.startedAt.toISOString(),
      finishedAt: this.finishedAt?.toISOString(),
      totalDurationMs: this.totalDurationMs,
      passed: this.passed,
      actors: {
        admin: this.admin.email,
        managers: this.managers.map(m => m.email),
        employees: this.employees.length,
        fullBrowser: this.fullBrowserEmployees.length,
        synthetic: this.syntheticEmployees.length,
      },
      expected: this.expected,
      actual: this.actual,
      phases: this.phases,
      discrepancies: this.getDiscrepancies(),
    };
  }

  getDiscrepancies(): Array<{ field: string; expected: number; actual: number; delta: number }> {
    const checks: Array<[string, number, number]> = [
      ['website_scans_in_db',     this.expected.totalWebsiteScans,     this.actual.websiteScansInDB],
      ['threat_reports_in_db',    this.expected.totalThreatReports,     this.actual.threatReportsInDB],
      ['api_threats_detected',    this.expected.totalThreatsDetected,   this.actual.apiThreatsDetected],
    ];

    return checks
      .filter(([, exp, act]) => exp !== act)
      .map(([field, exp, act]) => ({
        field,
        expected: exp,
        actual: act,
        delta: act - exp,
      }));
  }
}
