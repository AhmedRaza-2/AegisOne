/**
 * AegisOne E2E Simulation — Employee Behavior Profiles & Seeded Assignment
 *
 * Uses seedrandom to produce DETERMINISTIC behavior profiles from a seed string.
 * This means: same seed → same employee actions → same expected DB counts.
 *
 * Profile rates (% chance of each behavior when facing a phishing email):
 *   risky:           click=70%, report=10%, ignore=20%
 *   average:         click=30%, report=40%, ignore=30%
 *   security_aware:  click=10%, report=80%, ignore=10%
 */

import seedrandom from 'seedrandom';
import { Config } from '../config';
import { BehaviorProfile, SimulatedEmployee } from '../orchestrator/scenario-state';

export interface EmployeeSpec {
  firstName: string;
  lastName: string;
  departmentCode: string;
  role: 'employee' | 'manager';
}

// Click, report, ignore probabilities per profile
const PROFILE_RATES: Record<BehaviorProfile, [number, number, number]> = {
  risky:          [0.70, 0.10, 0.20],
  average:        [0.30, 0.40, 0.30],
  security_aware: [0.10, 0.80, 0.10],
};

// Profile distribution for 5-employee scenario
const PROFILE_POOL_5: BehaviorProfile[] = [
  'risky',
  'risky',
  'average',
  'average',
  'security_aware',
];

// Profile distribution for 20-employee scenario
const PROFILE_POOL_20: BehaviorProfile[] = [
  'risky',          // 1
  'risky',          // 2
  'risky',          // 3
  'risky',          // 4
  'risky',          // 5
  'risky',          // 6
  'average',        // 7
  'average',        // 8
  'average',        // 9
  'average',        // 10
  'average',        // 11
  'average',        // 12
  'average',        // 13
  'security_aware', // 14
  'security_aware', // 15
  'security_aware', // 16
  'security_aware', // 17
  'security_aware', // 18
  'security_aware', // 19
  'security_aware', // 20
];

// REAL_ACTOR_COUNT: how many employees get a full Playwright browser + extension
// The rest are API/synthetic actors
const REAL_ACTOR_COUNT = 3;

const EMPLOYEE_NAMES_5: EmployeeSpec[] = [
  { firstName: 'Alice',   lastName: 'Chen',    departmentCode: 'ENG',  role: 'employee' },
  { firstName: 'Bob',     lastName: 'Martinez', departmentCode: 'HR',   role: 'employee' },
  { firstName: 'Carol',   lastName: 'Smith',   departmentCode: 'FIN',  role: 'employee' },
  { firstName: 'David',   lastName: 'Lee',     departmentCode: 'ENG',  role: 'employee' },
  { firstName: 'Emma',    lastName: 'Taylor',  departmentCode: 'HR',   role: 'employee' },
];

const EMPLOYEE_NAMES_20: EmployeeSpec[] = [
  { firstName: 'Alice',   lastName: 'Chen',      departmentCode: 'ENG',  role: 'employee' },
  { firstName: 'Bob',     lastName: 'Martinez',  departmentCode: 'HR',   role: 'employee' },
  { firstName: 'Carol',   lastName: 'Smith',     departmentCode: 'FIN',  role: 'employee' },
  { firstName: 'David',   lastName: 'Lee',       departmentCode: 'ENG',  role: 'employee' },
  { firstName: 'Emma',    lastName: 'Taylor',    departmentCode: 'HR',   role: 'employee' },
  { firstName: 'Frank',   lastName: 'Wilson',    departmentCode: 'FIN',  role: 'employee' },
  { firstName: 'Grace',   lastName: 'Johnson',   departmentCode: 'ENG',  role: 'employee' },
  { firstName: 'Henry',   lastName: 'Brown',     departmentCode: 'HR',   role: 'employee' },
  { firstName: 'Iris',    lastName: 'Davis',     departmentCode: 'FIN',  role: 'employee' },
  { firstName: 'Jake',    lastName: 'Anderson',  departmentCode: 'ENG',  role: 'employee' },
  { firstName: 'Kate',    lastName: 'Thomas',    departmentCode: 'HR',   role: 'employee' },
  { firstName: 'Liam',    lastName: 'Jackson',   departmentCode: 'FIN',  role: 'employee' },
  { firstName: 'Mia',     lastName: 'White',     departmentCode: 'ENG',  role: 'employee' },
  { firstName: 'Noah',    lastName: 'Harris',    departmentCode: 'HR',   role: 'employee' },
  { firstName: 'Olivia',  lastName: 'Martin',    departmentCode: 'FIN',  role: 'employee' },
  { firstName: 'Peter',   lastName: 'Garcia',    departmentCode: 'ENG',  role: 'employee' },
  { firstName: 'Quinn',   lastName: 'Martinez',  departmentCode: 'HR',   role: 'employee' },
  { firstName: 'Rachel',  lastName: 'Robinson',  departmentCode: 'FIN',  role: 'employee' },
  { firstName: 'Sam',     lastName: 'Clark',     departmentCode: 'ENG',  role: 'employee' },
  { firstName: 'Tina',    lastName: 'Rodriguez', departmentCode: 'HR',   role: 'employee' },
];

/**
 * Generate a seeded, deterministic list of employees with behavior profiles.
 * The same seed always produces the same behaviors, enabling stable assertions.
 */
export function generateEmployees(
  orgId: string,
  scale: number,
  seed: string,
  adminEmail: string,
): SimulatedEmployee[] {
  const rng = seedrandom(seed);
  const specs = scale >= 20 ? EMPLOYEE_NAMES_20 : EMPLOYEE_NAMES_5;
  const profilePool = scale >= 20 ? PROFILE_POOL_20 : PROFILE_POOL_5;

  // Shuffle profile pool deterministically
  const profiles = [...profilePool];
  for (let i = profiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
  }

  const employees: SimulatedEmployee[] = specs.map((spec, idx) => {
    const profile = profiles[idx] ?? 'average';
    const [clickRate, reportRate] = PROFILE_RATES[profile];

    // Deterministic per-employee dice roll
    const roll = rng();
    const clickedPhishing = roll < clickRate;
    const reportedEmail = !clickedPhishing && (rng() < reportRate);
    const ignoredEmail = !clickedPhishing && !reportedEmail;

    // First REAL_ACTOR_COUNT employees get full Playwright + extension
    const actorType = idx < REAL_ACTOR_COUNT ? 'full_browser' : 'api_synthetic';

    // URL assignment: full_browser actors actually navigate; synthetic actors inject events
    const safeUrls = [...Config.SAFE_URLS];
    const suspiciousUrls = clickedPhishing
      ? [Config.SUSPICIOUS_URLS[idx % Config.SUSPICIOUS_URLS.length]]
      : [];
    const allUrls = [...safeUrls, ...suspiciousUrls];

    return {
      id: `e2e-emp-${String(idx + 1).padStart(3, '0')}`,
      firstName: spec.firstName,
      lastName: spec.lastName,
      email: `${spec.firstName.toLowerCase()}.${spec.lastName.toLowerCase()}@e2etest.aegisone.local`,
      password: `E2ePass${idx + 1}Aegis!`,
      departmentCode: spec.departmentCode,
      role: spec.role,
      lifecycleState: 'INITIALIZED' as const,
      profile,
      actorType,
      expected: {
        emailReceived: true,
        emailOpened: true,
        clickedPhishingLink: clickedPhishing,
        reportedEmail: reportedEmail,
        ignoredEmail: ignoredEmail,
        urlsVisited: actorType === 'full_browser' ? allUrls : [],
        urlsSuspicious: suspiciousUrls,
      },
      actual: {},
    };
  });

  return employees;
}

export function summarizeProfiles(employees: SimulatedEmployee[]): string {
  const totals = { click: 0, report: 0, ignore: 0, fullBrowser: 0, synthetic: 0 };
  for (const emp of employees) {
    if (emp.expected.clickedPhishingLink) totals.click++;
    else if (emp.expected.reportedEmail) totals.report++;
    else totals.ignore++;
    if (emp.actorType === 'full_browser') totals.fullBrowser++;
    else totals.synthetic++;
  }
  return (
    `  Employees: ${employees.length} total ` +
    `(${totals.fullBrowser} full-browser, ${totals.synthetic} synthetic)\n` +
    `  Behaviors: ${totals.click} click phishing | ${totals.report} report | ${totals.ignore} ignore`
  );
}
