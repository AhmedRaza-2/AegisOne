import axios from 'axios';

async function testResolution() {
  const baseURL = 'http://localhost:8000';
  const structureResp = await axios.get(`${baseURL}/setup/structure/org_default`);
  const employees = structureResp.data.employees || [];
  console.log("Returned Employees:");
  employees.forEach(e => console.log(` - ID: ${e.id}, Email: ${e.email}`));
}

testResolution().catch(console.error);
