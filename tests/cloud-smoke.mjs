// Read-only checks against the actual project. No user account or test family is created.
import assert from 'node:assert/strict';
const base = 'https://oqygpsltwyvwdfiyhzdw.supabase.co';
const key = 'sb_publishable_r1pTte6b-Sa4xdURkcz_zg_HafV6yLz';
const origin = 'https://herothgf-cell.github.io';
async function request(path, options = {}) {
  return fetch(base + path, {
    ...options,
    headers: { apikey: key, ...options.headers },
    signal: AbortSignal.timeout(20000),
  });
}
const settings = await request('/auth/v1/settings');
assert.equal(settings.status, 200, 'Supabase Auth must be reachable with the publishable key');
console.log('PASS Auth endpoint reachable');
console.log('Public authentication settings:', JSON.stringify(await settings.json()));
const data = await request('/rest/v1/families?select=id&limit=1');
assert.ok([401,403].includes(data.status), `Anonymous table read must be denied, got ${data.status}`);
console.log('PASS Anonymous family data access denied');
for (const authorization of [null, 'Bearer invalid-test-token']) {
  const response = await request('/functions/v1/family-action', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
    body: '{}',
  });
  assert.equal(response.status, 401, 'Missing or invalid user authentication must be denied');
  console.log('PASS', authorization ? 'Invalid user token denied' : 'Public key alone cannot authorize a command');
}
const preflight = await request('/functions/v1/family-action', {
  method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,content-type' },
});
assert.ok([200,204].includes(preflight.status), `Preflight failed: ${preflight.status}`);
assert.equal(preflight.headers.get('access-control-allow-origin'), origin, 'CORS origin must match Good Pages');
console.log('PASS Pages origin CORS preflight');
console.log('Not tested: real login, authenticated mutations, child sign-in, or cross-device synchronization.');
