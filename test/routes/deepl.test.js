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
import { fetchDeepLToken } from '../../src/routes/ints.js';

describe('fetchDeepLToken', () => {
  it('returns the configured apiKey as the access token, with no network call', async () => {
    const result = await fetchDeepLToken({ apiKey: 'deepl-key:fx' });

    assert.equal(result.status, 200);
    assert.deepEqual(result.json, { access_token: 'deepl-key:fx' });
  });

  it('returns a 400 when apiKey is missing', async () => {
    const result = await fetchDeepLToken({});

    assert.equal(result.status, 400);
    assert.match(result.error, /apiKey/);
  });
});
