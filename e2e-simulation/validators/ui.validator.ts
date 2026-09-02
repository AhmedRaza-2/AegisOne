import { Page } from '@playwright/test';
import { Config } from '../config';

export interface UIValidationResult {
  totalScans: number;
  threatsDetected: number;
}

export async function validateDashboardAnalytics(page: Page): Promise<UIValidationResult> {
  // Navigate to Analytics/Dashboard page
  await page.goto(`${Config.WEB_URL}/dashboard`);
  await page.waitForLoadState('networkidle');

  // We rely on data-testid for extraction (assuming they exist or we fallback to text parsing)
  // Let's try to find elements that contain "Total Scans" or "Threats Blocked"
  
  // We'll use a resilient locator strategy to extract numbers from stat cards
  const totalScansText = await page.locator('[data-testid="total-scans"], div:has-text("Total Scans") + div, div:has-text("total scans")').first().innerText().catch(() => '0');
  const threatsText = await page.locator('[data-testid="threats-blocked"], div:has-text("Threats Blocked") + div, div:has-text("threats blocked")').first().innerText().catch(() => '0');

  const extractNumber = (text: string) => {
    const num = text.replace(/[^0-9]/g, '');
    return num ? parseInt(num, 10) : 0;
  };

  return {
    totalScans: extractNumber(totalScansText),
    threatsDetected: extractNumber(threatsText),
  };
}
