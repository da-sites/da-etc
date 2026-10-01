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
import intRoute from '../../src/routes/ints.js';

function mockConfigFetch(rows) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({ config: { data: rows } }),
  });
}

describe('intRoute status action', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports connected without ever echoing the resolved LILT key', async () => {
    globalThis.fetch = mockConfigFetch([
      { key: 'translation.service.name', value: 'lilt' },
      { key: 'translation.service.prod.apiKey', value: 'super-secret-key' },
    ]);

    const req = new Request('https://da-etc.example/acme/sites/mysite/integrations/lilt/status?env=prod', {
      headers: { authorization: 'Bearer ims-token' },
    });
    const resp = await intRoute({
      req, org: 'acme', site: 'mysite', service: 'lilt', action: 'status',
    });
    const body = await resp.json();
    const text = JSON.stringify(body);

    assert.equal(resp.status, 200);
    assert.deepEqual(body, { connected: true });
    assert.doesNotMatch(text, /super-secret-key/);
  });

  it('reports not connected when no key is configured for the env', async () => {
    globalThis.fetch = mockConfigFetch([
      { key: 'translation.service.name', value: 'lilt' },
    ]);

    const req = new Request('https://da-etc.example/acme/sites/mysite/integrations/lilt/status?env=prod', {
      headers: { authorization: 'Bearer ims-token' },
    });
    const resp = await intRoute({
      req, org: 'acme', site: 'mysite', service: 'lilt', action: 'status',
    });
    const body = await resp.json();

    assert.equal(resp.status, 200);
    assert.deepEqual(body, { connected: false });
  });

  it('reports not connected with the underlying error when the translate config cannot be fetched', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });

    const req = new Request('https://da-etc.example/acme/sites/mysite/integrations/lilt/status?env=prod', {
      headers: { authorization: 'Bearer ims-token' },
    });
    const resp = await intRoute({
      req, org: 'acme', site: 'mysite', service: 'lilt', action: 'status',
    });
    const body = await resp.json();

    assert.equal(resp.status, 200);
    assert.deepEqual(body, { connected: false, error: 'Error fetching translate config from DA.' });
  });
});
