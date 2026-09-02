import { Page } from '@playwright/test';
import { Config } from '../config';
import { SimulatedEmployee } from '../orchestrator/scenario-state';

export async function runUiUserInvite(page: Page, employeesToInvite: SimulatedEmployee[]): Promise<void> {
  // Navigate to Admin Users page
  await page.goto(`${Config.WEB_URL}/dashboard/admin/users`);
  await page.waitForLoadState('networkidle');

  for (const emp of employeesToInvite) {
    // Click Add User button
    const addUserBtn = page.getByRole('button', { name: /add user/i }).first();
    await addUserBtn.click();
    await page.waitForTimeout(500);

    // Fill form
    await page.locator('input[placeholder*="Full Name"], input[name="fullName"]').fill(`${emp.firstName} ${emp.lastName}`);
    await page.locator('input[placeholder*="Email"], input[name="email"], input[type="email"]').fill(emp.email);
    
    // Select Role
    const roleSelect = page.locator('select[name="role"], button:has-text("Role")').first();
    if (await roleSelect.isVisible()) {
      if (await roleSelect.evaluate(el => el.tagName === 'SELECT')) {
        await roleSelect.selectOption(emp.role);
      } else {
        await roleSelect.click();
        await page.getByRole('option', { name: new RegExp(emp.role, 'i') }).click();
      }
    }

    // Submit
    const submitBtn = page.getByRole('button', { name: /invite|add user|save/i, exact: true }).first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }

    // Wait for the modal to close and backend to process
    await page.waitForTimeout(1500);
    console.log(`  ✓ UI Invited: ${emp.email} as ${emp.role}`);
  }
}
