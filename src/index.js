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

import { errorResponse, logUnhandled } from './utils/response.js';

/**
 * Maps a request path to a fixed route label for logging.
 * @param {string} pathname - Request URL pathname
 * @returns {string} 'cors', 'tags', 'integrations' or 'other'
 */
function routeLabel(pathname) {
  if (pathname.startsWith('/cors')) {
    return 'cors';
  }
  if (pathname.startsWith('/tags')) {
    return 'tags';
  }
  if (pathname.slice(1).split('/')[3] === 'integrations') {
    return 'integrations';
  }
  return 'other';
}

/**
 * Dispatches a request to its method handler.
 * @param {Request} req - Incoming request
 * @param {Object} env - Worker environment bindings
 * @returns {Promise<Response|null>} Handler response, or null if the route is unhandled
 */
function dispatch(req, env) {
  switch (req.method) {
    case 'OPTIONS':
      return optionsHandler({ req, env });
    case 'POST':
    case 'PUT':
    case 'DELETE':
      return postHandler({ req, env });
    case 'HEAD':
    case 'GET':
      return getHandler({ req, env });
    default:
      return errorResponse(405, 'Method not allowed');
  }
}

export default {
  async fetch(req, env) {
    try {
      const response = await dispatch(req, env);
      return response ?? errorResponse(404, 'Not found');
    } catch (error) {
      logUnhandled(error, { method: req.method, route: routeLabel(new URL(req.url).pathname) });
      return errorResponse(500, 'Internal server error');
    }
  },
};
