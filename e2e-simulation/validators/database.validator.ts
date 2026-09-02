/**
 * AegisOne E2E Simulation — Database Validator
 *
 * Directly queries PostgreSQL to assert actual state against expected outcomes.
 * Uses the real DB schema from postgres_schema.sql / database/models.py.
 *
 * Validates:
 *   - website_scans table (scan count, threat count, decisions)
 *   - security_events table (event types, severity)
 *   - threat_reports table (count, status)
 */

import { Pool, PoolClient } from 'pg';
import { Config } from '../config';
import { ExpectedOutcomes } from '../orchestrator/scenario-state';

export interface ValidationResult {
  passed: boolean;
  field: string;
  expected: number;
  actual: number;
  delta: number;
  message: string;
}

export interface DBSnapshot {
  websiteScans: number;
  websiteScansBlocked: number;
  websiteScansWarned: number;
  websiteScansSafe: number;
  securityEvents: number;
  securityEventsHigh: number;
  securityEventsMedium: number;
  threatReports: number;
  threatReportsSubmitted: number;
  credentialEvents: number;
}

export class DatabaseValidator {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      ...Config.DB,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      max: 5,
    });
  }

  /**
   * Take a snapshot of all relevant tables for the test org.
   * Uses the exact table names and column names from postgres_schema.sql.
   */
  async snapshot(orgId: string = 'org_default'): Promise<DBSnapshot> {
    const client = await this.pool.connect();
    try {
      const [ws, se, tr, ce] = await Promise.all([
        client.query<{
          total: string;
          blocked: string;
          warned: string;
          safe: string;
        }>(
          `SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE decision = 'block') AS blocked,
             COUNT(*) FILTER (WHERE decision = 'warn')  AS warned,
             COUNT(*) FILTER (WHERE decision = 'allow' OR decision = 'safe') AS safe
           FROM website_scans
           WHERE organization_id = $1`,
          [orgId],
        ),
        client.query<{
          total: string;
          high: string;
          medium: string;
        }>(
          `SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE severity = 'high')   AS high,
             COUNT(*) FILTER (WHERE severity = 'medium') AS medium
           FROM security_events
           WHERE organization_id = $1`,
          [orgId],
        ),
        client.query<{ total: string; submitted: string }>(
          `SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'submitted') AS submitted
           FROM threat_reports
           WHERE organization_id = $1`,
          [orgId],
        ),
        client.query<{ total: string }>(
          `SELECT COUNT(*) AS total FROM credential_events WHERE organization_id = $1`,
          [orgId],
        ),
      ]);

      const wsRow = ws.rows[0];
      const seRow = se.rows[0];
      const trRow = tr.rows[0];

      return {
        websiteScans:           parseInt(wsRow.total, 10),
        websiteScansBlocked:    parseInt(wsRow.blocked, 10),
        websiteScansWarned:     parseInt(wsRow.warned, 10),
        websiteScansSafe:       parseInt(wsRow.safe, 10),
        securityEvents:         parseInt(seRow.total, 10),
        securityEventsHigh:     parseInt(seRow.high, 10),
        securityEventsMedium:   parseInt(seRow.medium, 10),
        threatReports:          parseInt(trRow.total, 10),
        threatReportsSubmitted: parseInt(trRow.submitted, 10),
        credentialEvents:       parseInt(ce.rows[0].total, 10),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Assert website_scans count for full_browser employees.
   * These employees actually navigated URLs, so we expect one scan row per URL visit.
   */
  async assertWebsiteScans(
    orgId: string,
    minExpected: number,
  ): Promise<ValidationResult> {
    const snap = await this.snapshot(orgId);
    const actual = snap.websiteScans;
    const passed = actual >= minExpected;

    return {
      passed,
      field: 'website_scans.total',
      expected: minExpected,
      actual,
      delta: actual - minExpected,
      message: passed
        ? `✓ website_scans: ${actual} (expected ≥ ${minExpected})`
        : `✗ website_scans: got ${actual}, expected ≥ ${minExpected}`,
    };
  }

  /**
   * Assert threat reports match expected reports from security-aware employees.
   */
  async assertThreatReports(
    orgId: string,
    expectedReports: number,
  ): Promise<ValidationResult> {
    const snap = await this.snapshot(orgId);
    const actual = snap.threatReports;
    const passed = actual >= expectedReports;

    return {
      passed,
      field: 'threat_reports.total',
      expected: expectedReports,
      actual,
      delta: actual - expectedReports,
      message: passed
        ? `✓ threat_reports: ${actual} (expected ≥ ${expectedReports})`
        : `✗ threat_reports: got ${actual}, expected ≥ ${expectedReports}`,
    };
  }

  /**
   * Assert security events for threat/suspicious activity.
   * Synthetic actors inject events of type 'website_threat'.
   */
  async assertSecurityEvents(
    orgId: string,
    minExpected: number,
  ): Promise<ValidationResult> {
    const snap = await this.snapshot(orgId);
    const actual = snap.securityEvents;
    const passed = actual >= minExpected;

    return {
      passed,
      field: 'security_events.total',
      expected: minExpected,
      actual,
      delta: actual - minExpected,
      message: passed
        ? `✓ security_events: ${actual} (expected ≥ ${minExpected})`
        : `✗ security_events: got ${actual}, expected ≥ ${minExpected}`,
    };
  }

  /**
   * Run full validation suite against expected outcomes.
   * Returns an array of results — one per assertion.
   */
  async validateAll(
    orgId: string,
    expected: ExpectedOutcomes,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Only assert website_scans for full_browser actors
    if (expected.totalWebsiteScans > 0) {
      results.push(
        await this.assertWebsiteScans(orgId, expected.totalWebsiteScans),
      );
    }

    // Threat reports (from security_aware employees who reported)
    if (expected.totalThreatReports > 0) {
      results.push(
        await this.assertThreatReports(orgId, expected.totalThreatReports),
      );
    }

    // Security events (from synthetic actors injecting events)
    if (expected.totalSyntheticScans > 0) {
      results.push(
        await this.assertSecurityEvents(orgId, expected.totalSyntheticScans),
      );
    }

    return results;
  }

  /**
   * Check if PostgreSQL is reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
