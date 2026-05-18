//  SPRINT 3 TEST SUITE — REST API Layer
//  REQUIREMENTS:
//  → Backend running: npm run dev (Terminal 1)
//  → Run test: node src/test/sprint3.test.js (Terminal 2)
//
//  Uses HTTP requests to test every API endpoint
 
require('dotenv').config();
const http = require('http');

const BASE_URL  = 'http://localhost:5000';
let authToken   = null;
let passed      = 0;
let failed      = 0;

//HTTP helper
const request = (method, path, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port:     5000,
      path,
      method,
      headers: {
        'Content-Type':  'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(payload && { 'Content-Length': Buffer.byteLength(payload) }),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
};

const pass = (name, detail = '') => {
  passed++;
  console.log(` PASS  ${name}${detail ? ' — ' + detail : ''}`);
};

const fail = (name, reason) => {
  failed++;
  console.log(` FAIL  ${name} — ${reason}`);
};

const section = (title) => {
  console.log(`\n  ── ${title} ${'─'.repeat(40 - title.length)}`);
};

async function runTests() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║         AEMS — SPRINT 3 TEST SUITE                   ║');
  console.log('║         REST API Layer                               ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  // Test 1: Health check
  section('Health Check');
  try {
    const res = await request('GET', '/api/health');
    if (res.status === 200 && res.body.status === 'running') {
      pass('GET /api/health', `env: ${res.body.environment}`);
    } else {
      fail('GET /api/health', `status: ${res.status}`);
    }
  } catch {
    fail('GET /api/health', 'Backend not running — start npm run dev first');
    process.exit(1);
  }

  //Test 2: Auth — register
  section('Authentication');
  const testEmail = `test.sprint3.${Date.now()}@aems.com`;

  try {
    const res = await request('POST', '/api/auth/register', {
      name:        'Sprint3 Test User',
      email:       testEmail,
      password:    'TestPass123!',
      role:        'owner',
      business_id: 'business_demo_001',
    });

    if (res.status === 201 && res.body.token) {
      pass('POST /api/auth/register', 'user created, token received');
      authToken = res.body.token;
    } else {
      fail('POST /api/auth/register', `status: ${res.status} — ${res.body.error}`);
    }
  } catch (err) {
    fail('POST /api/auth/register', err.message);
  }

  // Test 3: Auth — login
  try {
    const res = await request('POST', '/api/auth/login', {
      email:    testEmail,
      password: 'TestPass123!',
    });

    if (res.status === 200 && res.body.token) {
      pass('POST /api/auth/login', `role: ${res.body.user.role}`);
      authToken = res.body.token;
    } else {
      fail('POST /api/auth/login', `status: ${res.status}`);
    }
  } catch (err) {
    fail('POST /api/auth/login', err.message);
  }

  // ── Test 4: Auth — wrong password ────────────────────────
  try {
    const res = await request('POST', '/api/auth/login', {
      email:    testEmail,
      password: 'WrongPassword!',
    });
    if (res.status === 401) {
      pass('POST /api/auth/login (wrong password)', '401 correctly returned');
    } else {
      fail('Wrong password rejection', `expected 401, got ${res.status}`);
    }
  } catch (err) {
    fail('Wrong password', err.message);
  }

  // ── Test 5: Protected route without token ────────────────
  try {
    const res = await request('GET', '/api/readings/live');
    if (res.status === 401) {
      pass('Protected route without token', '401 correctly returned');
    } else {
      fail('Route protection', `expected 401, got ${res.status}`);
    }
  } catch (err) {
    fail('Route protection', err.message);
  }

  // ── Test 6: GET /api/auth/me ─────────────────────────────
  try {
    const res = await request('GET', '/api/auth/me', null, authToken);
    if (res.status === 200 && res.body.user) {
      pass('GET /api/auth/me', `name: ${res.body.user.name}`);
    } else {
      fail('GET /api/auth/me', `status: ${res.status}`);
    }
  } catch (err) {
    fail('GET /api/auth/me', err.message);
  }

  // ── Test 7: Readings endpoints ───────────────────────────
  section('Readings API');
  try {
    const res = await request('GET', '/api/readings/live', null, authToken);
    if (res.status === 200 || res.status === 404) {
      pass('GET /api/readings/live', res.status === 200
        ? `voltage: ${res.body.reading?.main?.voltage}V`
        : 'no readings yet (404 expected)'
      );
    } else {
      fail('GET /api/readings/live', `unexpected status: ${res.status}`);
    }
  } catch (err) {
    fail('GET /api/readings/live', err.message);
  }

  try {
    const res = await request('GET', '/api/readings/today', null, authToken);
    if (res.status === 200) {
      pass('GET /api/readings/today', `${res.body.count} readings`);
    } else {
      fail('GET /api/readings/today', `status: ${res.status}`);
    }
  } catch (err) {
    fail('GET /api/readings/today', err.message);
  }

  try {
    const res = await request('GET', '/api/readings/summary?days=7', null, authToken);
    if (res.status === 200 && res.body.summaries) {
      pass('GET /api/readings/summary', `${res.body.days} days returned`);
    } else {
      fail('GET /api/readings/summary', `status: ${res.status}`);
    }
  } catch (err) {
    fail('GET /api/readings/summary', err.message);
  }

  // ── Test 8: Alerts endpoints ─────────────────────────────
  section('Alerts API');
  try {
    const res = await request('GET', '/api/alerts', null, authToken);
    if (res.status === 200) {
      pass('GET /api/alerts', `${res.body.count} active alerts`);
    } else {
      fail('GET /api/alerts', `status: ${res.status}`);
    }
  } catch (err) {
    fail('GET /api/alerts', err.message);
  }

  try {
    const res = await request('GET', '/api/alerts/history', null, authToken);
    if (res.status === 200) {
      pass('GET /api/alerts/history', `${res.body.count} total alerts`);
    } else {
      fail('GET /api/alerts/history', `status: ${res.status}`);
    }
  } catch (err) {
    fail('GET /api/alerts/history', err.message);
  }

  // Test 9: Bill estimate
  section('Bill API');
  try {
    const res = await request('GET', '/api/bill/estimate', null, authToken);
    if (res.status === 200 && res.body.tariff) {
      pass('GET /api/bill/estimate',
        `${res.body.current_kwh} kWh = ${res.body.current_cost_fcfa} FCFA`
      );
    } else {
      fail('GET /api/bill/estimate', `status: ${res.status}`);
    }
  } catch (err) {
    fail('GET /api/bill/estimate', err.message);
  }

  try {
    const res = await request('GET', '/api/bill/today', null, authToken);
    if (res.status === 200) {
      pass('GET /api/bill/today',
        `${res.body.kwh_today} kWh = ${res.body.cost_fcfa} FCFA today`
      );
    } else {
      fail('GET /api/bill/today', `status: ${res.status}`);
    }
  } catch (err) {
    fail('GET /api/bill/today', err.message);
  }

  // Test 10: 404 handler
  section('Error Handling');
  try {
    const res = await request('GET', '/api/this-route-does-not-exist');
    if (res.status === 404) {
      pass('404 handler', 'unknown routes return 404');
    } else {
      fail('404 handler', `expected 404, got ${res.status}`);
    }
  } catch (err) {
    fail('404 handler', err.message);
  }

  //Results 
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  if (failed === 0) {
    console.log(`║ ALL ${passed} TESTS PASSED                              ║`);
    console.log('║  Sprint 3 complete — REST API layer working           ║');
    console.log('║  Ready for Sprint 4 — WebSocket + Automation Engine   ║');
  } else {
    console.log(`║  Results: ${passed} passed   ${failed} failed                       ║`);
    console.log('║  Fix failures before Sprint 4                      ║');
  }
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);