import axios from 'axios';
import { Config } from '../config';
import { SimulatedEmployee } from '../orchestrator/scenario-state';

export async function bulkApiProvisionUsers(adminToken: string, employees: SimulatedEmployee[]): Promise<void> {
  const baseURL = Config.API_URL;
  const headers = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };

  for (const emp of employees) {
    try {
      const payload = {
        email: emp.email,
        full_name: `${emp.firstName} ${emp.lastName}`,
        role: emp.role,
        department_id: '', // Leave empty or fetch actual dept IDs if required
      };

      await axios.post(`${baseURL}/admin/users`, payload, {
        headers,
        timeout: Config.API_TIMEOUT_MS,
      });

      console.log(`  ✓ API Provisioned: ${emp.email} as ${emp.role}`);
    } catch (err: any) {
      console.error(`  ✗ Failed to API provision ${emp.email}:`, err.response?.data || err.message);
      throw err;
    }
  }
}
