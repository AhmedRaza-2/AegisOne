import axios from 'axios';
import { Config } from './config';
import { generateEmployees } from './fixtures/profiles';

async function test() {
  try {
    const employees = generateEmployees('org_default', 5, '20260831', 'admin@example.com');
    const emp = employees.find(e => e.actorType === 'api_synthetic');
    
    const events = [{
      id: `e2e-${emp.id}-test`,
      type: 'page_scan',
      org_id: 'org_default',
      device_id: 'test-device',
      url: 'https://github.com',
      domain: 'github.com',
      risk_score: 0,
      verdict: 'allow',
      details: { decision: 'allow' },
      user_id: undefined
    }];

    console.log("Sending payload:", JSON.stringify({ events }, null, 2));

    const res = await axios.post('http://localhost:8000/events/ingest', { events });
    console.log("SUCCESS:", res.data);
  } catch (err) {
    console.error("FAILED:");
    if (err.response) {
      console.error(err.response.status, err.response.data);
    } else {
      console.error(err.message);
    }
  }
}
test();
