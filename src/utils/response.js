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
import { DEF_HEADERS } from './constants.js';

/**
 * Builds a JSON error response with the standard body shape `{ error: string }`.
 * @param {number} status - HTTP status code
 * @param {string} message - Client-safe error message (never raw upstream/internal details)
 * @returns {Response} JSON error response
 */
export function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), { status, headers: DEF_HEADERS });
}

/**
 * Logs a structured error line. Callers must pass only static labels and
 * non-sensitive values (e.g. status codes), never request or upstream data.
 * @param {string} message - Static description of the failure
 * @param {Object} [details] - Extra non-sensitive fields to include
 * @returns {void}
 */
export function logError(message, details = {}) {
  console.error(JSON.stringify({ message, ...details }));
}

const KNOWN_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
const KNOWN_ROUTES = new Set(['cors', 'tags', 'integrations']);

/**
 * Logs an unexpected error with only a sanitized error name plus the request method and
 * route label. The message and stack are never logged since they can embed untrusted input,
 * and method/route are checked against fixed allowlists rather than taken from the request.
 * @param {unknown} error - The caught error
 * @param {Object} [context] - Request context
 * @param {string} [context.method] - HTTP method
 * @param {string} [context.route] - Route label: 'cors', 'tags' or 'integrations'
 * @returns {void}
 */
export function logUnhandled(error, { method, route } = {}) {
  const name = error instanceof Error && /^[\w$]{1,64}$/.test(error.name) ? error.name : 'Error';
  logError('Unhandled error', {
    name,
    method: KNOWN_METHODS.has(method) ? method : 'other',
    route: KNOWN_ROUTES.has(route) ? route : 'other',
  });
}
