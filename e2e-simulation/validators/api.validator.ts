/**
 * AegisOne E2E Simulation — API Validator
 *
 * Validates the AegisOne REST API responses against expected simulation outcomes.
 * Uses real endpoints from admin.py and compatibility.py.
 */

import axios from 'axios';
import { Config } from '../config';
import { ExpectedOutcomes, ScenarioState } from '../orchestrator/scenario-state';
import { ValidationResult } from './database.validator';
import { refreshAdminToken } from '../fixtures/seed';

export interface APIStats {
  totalScans: number;
  threatsDetected: number;
  totalUsers: number;
  scansToday: number;
  threatsToday: number;
  threatReportsPending: number;
}

export class APIValidator {
  /**
   * Fetch admin stats from GET /admin/stats
   * Real endpoint from admin.py
   */
  async getAdminStats(state: ScenarioState, timeRange = '24h'): Promise<APIStats> {
    const token = state.admin.token ?? await refreshAdminToken(state);

    const resp = await axios.get(
      `${Config.API_URL}/admin/stats?time_range=${timeRange}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: Config.API_TIMEOUT_MS,
      },
    );

    const d = resp.data;
    return {
      totalScans:           d.total_scans           ?? 0,
      threatsDetected:      d.threats_detected       ?? 0,
      totalUsers:           d.total_users            ?? 0,
      scansToday:           d.scans_today            ?? 0,
      threatsToday:         d.threats_today          ?? 0,
      threatReportsPending: d.threat_reports_pending ?? 0,
    };
  }

  /**
   * Fetch paginated scan list from GET /admin/scans
   */
  async getScanList(state: ScenarioState): Promise<{ total: number; scans: unknown[] }> {
    const token = state.admin.token ?? await refreshAdminToken(state);

    const resp = await axios.get(
      `${Config.API_URL}/admin/scans?page_size=100`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: Config.API_TIMEOUT_MS,
      },
    );

    return {
      total: resp.data.scans?.length ?? 0,
      scans: resp.data.scans ?? [],
    };
  }

  /**
   * Fetch threat reports from GET /admin/reports
   */
  async getReports(state: ScenarioState): Promise<{ total: number; reports: unknown[] }> {
    const token = state.admin.token ?? await refreshAdminToken(state);

    const resp = await axios.get(
      `${Config.API_URL}/admin/reports?page_size=100`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: Config.API_TIMEOUT_MS,
      },
    );

    return {
      total: resp.data.reports?.length ?? 0,
      reports: resp.data.reports ?? [],
    };
  }

  /**
   * Validate API responses against expected outcomes.
   * Uses the actual /admin/stats response structure from admin.py → AdminStatsResponse.
   */
  async validateAll(
    state: ScenarioState,
    expected: ExpectedOutcomes,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const apiStats = await this.getAdminStats(state);

    // Validate: total scans ≥ expected browser + synthetic scans
    const expectedScans = expected.totalWebsiteScans + expected.totalSyntheticScans;
    if (expectedScans > 0) {
      const passed = apiStats.totalScans >= expectedScans;
      results.push({
        passed,
        field: 'api.total_scans',
        expected: expectedScans,
        actual: apiStats.totalScans,
        delta: apiStats.totalScans - expectedScans,
        message: passed
          ? `✓ API total_scans: ${apiStats.totalScans} (≥ ${expectedScans})`
          : `✗ API total_scans: got ${apiStats.totalScans}, expected ≥ ${expectedScans}`,
      });
    }

    // Validate: threat reports pending
    if (expected.totalThreatReports > 0) {
      const passed = apiStats.threatReportsPending >= expected.totalThreatReports;
      results.push({
        passed,
        field: 'api.threat_reports_pending',
        expected: expected.totalThreatReports,
        actual: apiStats.threatReportsPending,
        delta: apiStats.threatReportsPending - expected.totalThreatReports,
        message: passed
          ? `✓ API threat_reports_pending: ${apiStats.threatReportsPending}`
          : `✗ API threat_reports_pending: got ${apiStats.threatReportsPending}, expected ≥ ${expected.totalThreatReports}`,
      });
    }

    // Validate: user count (all provisioned employees should be in the system)
    const expectedUsers = state.employees.length + 1; // +1 for admin
    const passed = apiStats.totalUsers >= expectedUsers;
    results.push({
      passed,
      field: 'api.total_users',
      expected: expectedUsers,
      actual: apiStats.totalUsers,
      delta: apiStats.totalUsers - expectedUsers,
      message: passed
        ? `✓ API total_users: ${apiStats.totalUsers}`
        : `✗ API total_users: got ${apiStats.totalUsers}, expected ≥ ${expectedUsers}`,
    });

    return results;
  }

  /**
   * Trigger dashboard stats refresh (forces re-aggregation from event tables).
   * POST /admin/stats/refresh — from admin.py
   */
  async triggerStatsRefresh(state: ScenarioState): Promise<void> {
    const token = state.admin.token ?? await refreshAdminToken(state);

    await axios.post(
      `${Config.API_URL}/admin/stats/refresh`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: Config.API_TIMEOUT_MS,
      },
    );
  }
}
