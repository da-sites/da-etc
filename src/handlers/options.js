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
import { ALLOWED_DOMAINS, DEF_HEADERS } from '../utils/constants.js';

export default async function optionsHandler({ req }) {
  const origin = req.headers.get('origin');
  if (!origin) {
    return null;
  }

  const { hostname } = new URL(origin);
  const domain = hostname.split('.').slice(-2).join('.');

  if (ALLOWED_DOMAINS.includes(domain)) {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'HEAD, GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  return new Response('Method not allowed', { status: 405, headers: DEF_HEADERS });
}
