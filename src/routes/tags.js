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
import cleanHtml from '../utils/html.js';
import extractTags from '../utils/openai.js';

import { DEF_HEADERS } from '../utils/constants.js';
import { errorResponse } from '../utils/response.js';

export default async function tagsRoute({ req, env }) {
  let body;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body');
  }

  const { html } = body ?? {};
  if (typeof html !== 'string' || !html) {
    return errorResponse(400, 'Missing html');
  }

  const cleaned = cleanHtml(html);
  const tags = await extractTags({ html: cleaned, env });
  return new Response(JSON.stringify(tags), {
    status: 200,
    headers: DEF_HEADERS,
  });
}
