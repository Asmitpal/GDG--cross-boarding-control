#!/usr/bin/env node
/**
 * Quick API smoke test — run after `docker compose up` + migrations
 * Usage: node smoke-test.mjs
 */

const BASE = 'http://localhost:3001/api/v1';
const HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': 'dev-secret-key-change-in-prod',
};

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function run() {
  console.log('\n🧪  Cross-Boarding API Smoke Test\n');

  // Health
  const health = await fetch('http://localhost:3001/health').then(r => r.json());
  console.log('✅  Health:', health.status);

  // Rules
  const rules = await req('GET', '/rules');
  console.log('✅  Rules fetched:', Object.keys(rules.data.departments).length, 'departments');

  // Create hire
  const hire = await req('POST', '/hires', {
    fullName:    'Test Engineer',
    jobTitle:    'Software Engineer',
    department:  'Engineering',
    level:       'IC',
    startDate:   '2026-09-01',
    managerName: 'Test Manager',
  });
  const hireId = hire.data.id;
  console.log(`✅  Hire created: ${hireId} (${hire.data.tasks.length} tasks)`);

  // List hires
  const list = await req('GET', '/hires');
  console.log(`✅  Hires list: ${list.total} total`);

  // Get hire detail
  const detail = await req('GET', `/hires/${hireId}`);
  console.log(`✅  Hire detail: readiness=${detail.data.readiness}%`);

  // Approve
  const approved = await req('POST', `/hires/${hireId}/approval`, {
    decision: 'APPROVED',
    resolvedBy: 'smoke-test',
  });
  console.log(`✅  Approval processed: status=${approved.data.status}`);

  // Toggle a task
  const task = approved.data.tasks.find(t => t.status === 'PENDING' && t.owner === 'HR');
  if (task) {
    await req('PATCH', `/tasks/${task.id}`, { completed: true });
    console.log(`✅  Task toggled: ${task.label}`);
  }

  // Escalations
  const escs = await req('GET', '/escalations');
  console.log(`✅  Escalations: ${escs.total}`);

  console.log('\n🎉  All checks passed!\n');
}

run().catch(err => {
  console.error('\n❌  Smoke test failed:', err.message);
  process.exit(1);
});
