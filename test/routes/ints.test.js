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
import { fetchSmartlingToken } from '../../src/routes/ints.js';

describe('fetchSmartlingToken', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('exchanges userIdentifier/userSecret for a token', async () => {
    let calledUrl;
    let calledOpts;
    globalThis.fetch = async (url, opts) => {
      calledUrl = url;
      calledOpts = opts;
      return {
        ok: true,
        status: 200,
        json: async () => ({ response: { data: { accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 } } }),
      };
    };

    const result = await fetchSmartlingToken({
      userIdentifier: 'user-id',
      userSecret: 'secret',
      authEndpoint: 'https://api.smartling.com',
    });

    assert.equal(calledUrl, 'https://api.smartling.com/auth-api/v2/authenticate');
    assert.equal(calledOpts.method, 'POST');
    assert.deepEqual(JSON.parse(calledOpts.body), { userIdentifier: 'user-id', userSecret: 'secret' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.json, { response: { data: { accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 } } });
  });

  it('falls back to userId when userIdentifier is absent, for configs predating the rename', async () => {
    let calledBody;
    globalThis.fetch = async (url, opts) => {
      calledBody = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };

    await fetchSmartlingToken({
      userId: 'legacy-user-id',
      userSecret: 'secret',
      authEndpoint: 'https://api.smartling.com',
    });

    assert.deepEqual(calledBody, { userIdentifier: 'legacy-user-id', userSecret: 'secret' });
  });

  it('prefers userIdentifier over userId when both are present', async () => {
    let calledBody;
    globalThis.fetch = async (url, opts) => {
      calledBody = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };

    await fetchSmartlingToken({
      userIdentifier: 'new-user-id',
      userId: 'legacy-user-id',
      userSecret: 'secret',
      authEndpoint: 'https://api.smartling.com',
    });

    assert.deepEqual(calledBody, { userIdentifier: 'new-user-id', userSecret: 'secret' });
  });

  it('defaults authEndpoint to https://api.smartling.com when not provided', async () => {
    let calledUrl;
    globalThis.fetch = async (url) => {
      calledUrl = url;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };

    await fetchSmartlingToken({ userIdentifier: 'user-id', userSecret: 'secret' });

    assert.equal(calledUrl, 'https://api.smartling.com/auth-api/v2/authenticate');
  });

  it('returns a 400 when both userIdentifier and userId are missing', async () => {
    const result = await fetchSmartlingToken({ userSecret: 'secret', authEndpoint: 'https://api.smartling.com' });
    assert.equal(result.status, 400);
    assert.match(result.error, /userIdentifier/);
  });

  it('returns a 400 when userSecret is missing', async () => {
    const result = await fetchSmartlingToken({ userIdentifier: 'user-id', authEndpoint: 'https://api.smartling.com' });
    assert.equal(result.status, 400);
    assert.match(result.error, /userSecret/);
  });

  it('surfaces the upstream status when the token exchange fails', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 401 });

    const result = await fetchSmartlingToken({
      userIdentifier: 'user-id',
      userSecret: 'wrong-secret',
      authEndpoint: 'https://api.smartling.com',
    });

    assert.equal(result.status, 401);
    assert.equal(result.error, 'Could not get token');
  });
});
