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
import { fetchGlobalLinkToken } from '../../src/routes/ints.js';

describe('fetchGlobalLinkToken', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('exchanges username/password for a token via a Basic-auth resource-owner password grant', async () => {
    let calledUrl;
    let calledOpts;
    globalThis.fetch = async (url, opts) => {
      calledUrl = url;
      calledOpts = opts;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'tok', token_type: 'bearer', expires_in: 3600 }),
      };
    };

    const result = await fetchGlobalLinkToken({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      endpoint: 'https://api.globallink.example',
      username: 'user@example.com',
      password: 'user-password',
    });

    assert.equal(calledUrl, 'https://api.globallink.example/oauth/token');
    assert.equal(calledOpts.method, 'POST');
    assert.equal(calledOpts.headers.Authorization, `Basic ${btoa('client-id:client-secret')}`);
    assert.equal(calledOpts.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.deepEqual(
      Object.fromEntries(new URLSearchParams(calledOpts.body)),
      { grant_type: 'password', username: 'user@example.com', password: 'user-password' },
    );
    assert.equal(result.status, 200);
    assert.deepEqual(result.json, { access_token: 'tok', token_type: 'bearer', expires_in: 3600 });
  });

  it('returns a 400 when endpoint is missing', async () => {
    const result = await fetchGlobalLinkToken({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      username: 'user@example.com',
      password: 'user-password',
    });
    assert.equal(result.status, 400);
    assert.match(result.error, /endpoint/);
  });

  it('returns a 400 when clientId is missing', async () => {
    const result = await fetchGlobalLinkToken({
      clientSecret: 'client-secret',
      endpoint: 'https://api.globallink.example',
      username: 'user@example.com',
      password: 'user-password',
    });
    assert.equal(result.status, 400);
    assert.match(result.error, /clientId/);
  });

  it('returns a 400 when clientSecret is missing', async () => {
    const result = await fetchGlobalLinkToken({
      clientId: 'client-id',
      endpoint: 'https://api.globallink.example',
      username: 'user@example.com',
      password: 'user-password',
    });
    assert.equal(result.status, 400);
    assert.match(result.error, /clientSecret/);
  });

  it('returns a 400 when username is missing', async () => {
    const result = await fetchGlobalLinkToken({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      endpoint: 'https://api.globallink.example',
      password: 'user-password',
    });
    assert.equal(result.status, 400);
    assert.match(result.error, /username/);
  });

  it('returns a 400 when password is missing', async () => {
    const result = await fetchGlobalLinkToken({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      endpoint: 'https://api.globallink.example',
      username: 'user@example.com',
    });
    assert.equal(result.status, 400);
    assert.match(result.error, /password/);
  });

  it('surfaces the upstream status when the token exchange fails', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 401 });

    const result = await fetchGlobalLinkToken({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      endpoint: 'https://api.globallink.example',
      username: 'user@example.com',
      password: 'wrong-password',
    });

    assert.equal(result.status, 401);
    assert.equal(result.error, 'Could not get token');
  });
});
