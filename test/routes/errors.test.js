/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import assert from 'node:assert/strict';
import worker from '../../src/index.js';

describe('error handling', () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  let logged;

  beforeEach(() => {
    logged = [];
    console.error = (...args) => logged.push(args.join(' '));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  });

  async function assertErrorBody(resp, status, message) {
    assert.equal(resp.status, status);
    assert.equal(resp.headers.get('content-type'), 'application/json');
    assert.deepEqual(await resp.json(), { error: message });
  }

  it('returns a generic 500 and does not leak or log the error message for unknown errors', async () => {
    globalThis.fetch = async () => {
      throw new Error('boom: secret-token-123');
    };
    const req = new Request('https://da-etc.example/cors?url=https%3A%2F%2Fexample.com%2F');
    const resp = await worker.fetch(req, {});

    await assertErrorBody(resp, 500, 'Internal server error');
    assert.equal(logged.length, 1);
    assert.ok(!logged[0].includes('secret-token-123'));
    assert.ok(logged[0].includes('Unhandled error'));
  });

  it('logs only the sanitized name, method and route label, never message or stack text', async () => {
    globalThis.fetch = async () => {
      const err = new Error('bad input\n    at token=sk-live-123');
      err.name = 'Evil\n    at injected';
      throw err;
    };
    const req = new Request('https://da-etc.example/cors?url=https%3A%2F%2Fexample.com%2F&k=sk-live-123');
    await worker.fetch(req, {});

    assert.equal(logged.length, 1);
    assert.deepEqual(JSON.parse(logged[0]), {
      message: 'Unhandled error', name: 'Error', method: 'GET', route: 'cors',
    });
  });

  it('labels integration routes without logging path segments', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('x');
    };
    const req = new Request('https://da-etc.example/acme-secret-org/config/site/integrations/trados/login', {
      method: 'POST',
      headers: { authorization: 'Bearer t' },
    });
    await worker.fetch(req, {});

    assert.deepEqual(JSON.parse(logged[0]), {
      message: 'Unhandled error', name: 'TypeError', method: 'POST', route: 'integrations',
    });
    assert.ok(!logged[0].includes('acme-secret-org'));
  });

  it('logs no details for non-Error throws', async () => {
    globalThis.fetch = async () => {
      throw 'secret string'; // eslint-disable-line no-throw-literal
    };
    const req = new Request('https://da-etc.example/cors?url=https%3A%2F%2Fexample.com%2F');
    await worker.fetch(req, {});

    assert.ok(!logged[0].includes('secret string'));
  });

  it('returns a JSON 405 for unsupported methods', async () => {
    const resp = await worker.fetch(new Request('https://da-etc.example/', { method: 'PATCH' }), {});
    await assertErrorBody(resp, 405, 'Method not allowed');
  });

  it('returns a JSON 404 for unhandled routes', async () => {
    const resp = await worker.fetch(new Request('https://da-etc.example/nope', { method: 'POST' }), {});
    await assertErrorBody(resp, 404, 'Not found');
  });

  it('returns a JSON 405 for OPTIONS from a disallowed origin', async () => {
    const req = new Request('https://da-etc.example/', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    });
    await assertErrorBody(await worker.fetch(req, {}), 405, 'Method not allowed');
  });

  it('returns 400 for missing or invalid cors target URLs', async () => {
    await assertErrorBody(await worker.fetch(new Request('https://da-etc.example/cors'), {}), 400, 'Missing target URL');
    const bad = new Request('https://da-etc.example/cors?url=not-a-url');
    await assertErrorBody(await worker.fetch(bad, {}), 400, 'Invalid target URL');
    const malformed = new Request('https://da-etc.example/cors?url=%25E0%25A4%25A');
    await assertErrorBody(await worker.fetch(malformed, {}), 400, 'Invalid target URL');
    const ftp = new Request('https://da-etc.example/cors?url=ftp%3A%2F%2Fexample.com');
    await assertErrorBody(await worker.fetch(ftp, {}), 400, 'Invalid target URL');
  });

  it('returns 400 for invalid tags bodies', async () => {
    const bad = new Request('https://da-etc.example/tags', { method: 'POST', body: 'nope' });
    await assertErrorBody(await worker.fetch(bad, {}), 400, 'Invalid JSON body');
    const empty = new Request('https://da-etc.example/tags', { method: 'POST', body: '{}' });
    await assertErrorBody(await worker.fetch(empty, {}), 400, 'Missing html');
  });

  it('returns an object-shaped error for integration failures and logs status only', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    const req = new Request('https://da-etc.example/acme/config/site/integrations/trados/login', {
      method: 'POST',
      headers: { authorization: 'Bearer user-secret' },
    });
    const resp = await worker.fetch(req, {});

    await assertErrorBody(resp, 404, 'Error fetching translate config from DA.');
    assert.equal(logged.length, 1);
    assert.ok(!logged[0].includes('user-secret'));
  });

  it('returns 401 JSON without authorization', async () => {
    const req = new Request('https://da-etc.example/acme/config/site/integrations/trados/login', { method: 'POST' });
    await assertErrorBody(await worker.fetch(req, {}), 401, 'Missing authorization header');
  });
});
