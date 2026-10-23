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
import { DEF_HEADERS } from '../utils/constants.js';

export default async function corsRoute({ req }) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing target URL' }), {
      status: 400,
      headers: DEF_HEADERS,
    });
  }

  const decodedUrl = decodeURIComponent(targetUrl);

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('origin');

  const opts = { method: req.method, headers, body: req.body };

  if (req.method === 'HEAD') {
    opts.redirect = 'manual';
    opts.body = null;
  }

  const response = await fetch(decodedUrl, opts);

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'HEAD, GET, PUT, POST, DELETE');
  responseHeaders.set('Access-Control-Allow-Headers', '*');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
