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
import optionsHandler from './handlers/options.js';
import postHandler from './handlers/post.js';
import getHandler from './handlers/get.js';

import { DEF_HEADERS } from './utils/constants.js';

export default {
  async fetch(req, env) {
    try {
      switch (req.method) {
        case 'OPTIONS':
          return await optionsHandler({ req, env });
        case 'POST':
          return await postHandler({ req, env });
        case 'PUT':
          return await postHandler({ req, env });
        case 'HEAD':
          return await getHandler({ req, env });
        case 'GET':
          return await getHandler({ req, env });
        case 'DELETE':
          return await postHandler({ req, env });
        default:
          return new Response('Method not allowed', { status: 405, headers: DEF_HEADERS });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: DEF_HEADERS
      });
    }
  }
};
