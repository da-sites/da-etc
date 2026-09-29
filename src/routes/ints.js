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

const BASE_OPTS = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
};

/**
 * Checks a service's resolved config for missing required values and, if any are
 * missing, returns a 400 error naming each one. Used by every token fetcher so
 * config errors consistently say exactly which value(s) are absent.
 * @param {string} serviceName - Human-readable service name for the error message
 * @param {Object} fields - Map of required field name to its resolved value
 * @returns {Object|null} `{ error, status: 400 }` if any field is missing, else `null`
 */
function missingConfigError(serviceName, fields) {
  const missing = Object.entries(fields)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (!missing.length) {
    return null;
  }
  return { error: `Missing ${serviceName} service config: ${missing.join(', ')}.`, status: 400 };
}

async function fetchTranslateConfig(org, site, authorization) {
  const opts = { headers: { Authorization: authorization } };

  const resp = await fetch(`https://admin.da.live/source/${org}/${site}/.da/translate.json`, opts);
  if (!resp.ok) {
    return {
      error: 'Error fetching translate config from DA.',
      status: resp.status,
    };
  }

  const json = await resp.json();
  return { json };
}

function rowsToMap(rows) {
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

function extractEnvs(config) {
  const envs = {};
  Object.keys(config).forEach((key) => {
    if (!key.startsWith('translation.service.')) {
      return;
    }
    const [env, prop] = key.replace('translation.service.', '').split('.');
    if (env === 'name' || env === 'all' || env === 'key') {
      return;
    }
    envs[env] ??= {};
    envs[env][prop] = config[key];
  });
  return envs;
}

function formatConfig(json) {
  const config = rowsToMap(json.config.data);
  return {
    name: config['translation.service.name'],
    keyPath: config['translation.service.key.path'],
    envs: extractEnvs(config),
  };
}

function formatServiceKey(json) {
  return extractEnvs(rowsToMap(json.data));
}

async function fetchServiceKey(keyPath, authorization) {
  console.log('fetchServiceKey: fetching', keyPath);
  const resp = await fetch(keyPath, { headers: { Authorization: authorization } });
  console.log('fetchServiceKey: response status', resp.status, resp.statusText);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '<unreadable body>');
    console.log('fetchServiceKey: error body', text);
    return {
      error: 'Error fetching service key from DA.',
      status: resp.status,
    };
  }
  const json = await resp.json();
  console.log('fetchServiceKey: json keys', Object.keys(json));
  return { json };
}

/**
 * Exchanges Trados client credentials for an OAuth2 access token.
 * @param {Object} service - Resolved env credentials (clientId, clientSecret, authEndpoint)
 * @returns {Promise<Object>} `{ json, status }` on success, or `{ error, status }` on failure
 */
async function fetchTradosToken(service) {
  const { clientId, clientSecret, authEndpoint } = service;
  const missingConfig = missingConfigError('Trados', { authEndpoint, clientId, clientSecret });
  if (missingConfig) {
    return missingConfig;
  }

  const body = JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    audience: service.audience,
  });

  const opts = { ...BASE_OPTS, body };
  const resp = await fetch(authEndpoint, opts);
  if (!resp.ok) {
    return { error: 'Could not get token', status: resp.status };
  }
  const json = await resp.json();
  return { json, status: resp.status };
}

/**
 * Exchanges Lionbridge client credentials for an OAuth2 access token.
 * @param {Object} service - Resolved env credentials (clientId, clientSecret, authEndpoint)
 * @returns {Promise<Object>} `{ json, status }` on success, or `{ error, status }` on failure
 */
async function fetchLionbridgeToken(service) {
  const { clientId, clientSecret, authEndpoint } = service;
  const missingConfig = missingConfigError('Lionbridge', { authEndpoint, clientId, clientSecret });
  if (missingConfig) {
    return missingConfig;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const opts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  };
  const resp = await fetch(authEndpoint, opts);
  if (!resp.ok) {
    return { error: 'Could not get token', status: resp.status };
  }
  const json = await resp.json();
  return { json, status: resp.status };
}

/**
 * Exchanges a Smartling userIdentifier/userSecret pair for an access/refresh
 * token pair. Unlike the OAuth2 client_credentials flow used by Trados and
 * Lionbridge, Smartling has its own token endpoint and response shape
 * (`{ response: { data: { accessToken, refreshToken, expiresIn } } }`), so
 * the raw response is passed through unchanged rather than reshaped.
 * @param {Object} service - Resolved env credentials (userIdentifier, userSecret, authEndpoint).
 * `userId` is also accepted as an alias for `userIdentifier`, for configs predating the rename.
 * `authEndpoint` defaults to `https://api.smartling.com` when not provided.
 * @returns {Promise<Object>} `{ json, status }` on success, or `{ error, status }` on failure
 */
export async function fetchSmartlingToken(service) {
  const {
    userIdentifier = service.userId,
    userSecret,
    authEndpoint = 'https://api.smartling.com',
  } = service;
  const missingConfig = missingConfigError('Smartling', { authEndpoint, userIdentifier, userSecret });
  if (missingConfig) {
    return missingConfig;
  }

  const body = JSON.stringify({ userIdentifier, userSecret });
  const opts = { ...BASE_OPTS, body };
  const resp = await fetch(`${authEndpoint}/auth-api/v2/authenticate`, opts);
  if (!resp.ok) {
    return { error: 'Could not get token', status: resp.status };
  }
  const json = await resp.json();
  return { json, status: resp.status };
}

/**
 * Exchanges GlobalLink client credentials and a user's password for an OAuth2 access
 * token (resource-owner password grant, Basic-auth'd with the client id/secret). Unlike
 * Trados/Lionbridge's client_credentials grant, GlobalLink also requires a per-user
 * username/password, so those must be resolved alongside clientId/clientSecret.
 * @param {Object} service - Resolved env credentials (clientId, clientSecret, endpoint,
 * username, password)
 * @returns {Promise<Object>} `{ json, status }` on success, or `{ error, status }` on failure
 */
export async function fetchGlobalLinkToken(service) {
  const {
    clientId, clientSecret, endpoint, username, password,
  } = service;
  const missingConfig = missingConfigError('GlobalLink', {
    endpoint, clientId, clientSecret, username, password,
  });
  if (missingConfig) {
    return missingConfig;
  }

  const body = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
  });
  const opts = {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  };
  const resp = await fetch(`${endpoint}/oauth/token`, opts);
  if (!resp.ok) {
    console.log('fetchGlobalLinkToken: error response', resp.status, resp);
    return { error: 'Could not get token', status: resp.status };
  }
  const json = await resp.json();
  return { json, status: resp.status };
}

/**
 * Resolves the site's configured DeepL API key. Unlike Trados/Lionbridge/Smartling/
 * GlobalLink, DeepL has no OAuth exchange - the API key itself is the long-lived
 * credential DeepL expects on every request (as `Authorization: DeepL-Auth-Key <key>`).
 * Routing it through da-etc still keeps the raw key out of the site's editable config
 * sheet and the browser's own request path, matching the other connectors' security
 * model, even though there's no token to refresh.
 * @param {Object} service - Resolved env credentials (apiKey)
 * @returns {Promise<Object>} `{ json, status }` on success, or `{ error, status }` on failure
 */
export async function fetchDeepLToken(service) {
  const { apiKey } = service;
  const missingConfig = missingConfigError('DeepL', { apiKey });
  if (missingConfig) {
    return missingConfig;
  }

  return { json: { access_token: apiKey }, status: 200 };
}

const TOKEN_FETCHERS = {
  trados: fetchTradosToken,
  lionbridge: fetchLionbridgeToken,
  smartling: fetchSmartlingToken,
  globallink: fetchGlobalLinkToken,
  deepl: fetchDeepLToken,
};

function handleError({ error, status }) {
  return new Response(JSON.stringify(error), { status, headers: DEF_HEADERS });
}

/**
 * Resolves the client credentials for a service/env by fetching the site's
 * translate config and, if configured, a referenced service key document.
 * Credential presence is validated by each connector's own fetchXToken, not here.
 * @param {string} org - DA org name
 * @param {string} site - DA site name
 * @param {string} authorization - Authorization header value for the DA admin API
 * @param {string} serviceEnv - Environment key to resolve credentials for (e.g. 'prod')
 * @returns {Promise<Object>} `{ json: envCreds }` on success, or `{ error, status }` on failure
 */
async function fetchEnvCreds(org, site, authorization, serviceEnv) {
  const cfgResult = await fetchTranslateConfig(org, site, authorization);

  console.log('intRoute: cfgResult', cfgResult);

  if (cfgResult.error) {
    return cfgResult;
  }

  const svcCfg = formatConfig(cfgResult.json);

  console.log('intRoute: svcCfg', { name: svcCfg.name, keyPath: svcCfg.keyPath, envs: Object.keys(svcCfg.envs) });

  let envCreds = svcCfg.envs[serviceEnv] ?? {};
  if (svcCfg.keyPath) {
    const keyResult = await fetchServiceKey(svcCfg.keyPath, authorization);
    if (keyResult.error) {
      return keyResult;
    }
    const keyEnvs = formatServiceKey(keyResult.json);
    envCreds = { ...envCreds, ...(keyEnvs[serviceEnv] ?? {}) };
  }

  console.log('intRoute: envCreds for', serviceEnv, envCreds ? Object.keys(envCreds) : '<none>');

  return { json: envCreds };
}

export default async function intRoute({
  req, org, site, service, action,
}) {
  const authorization = req.headers.get('authorization');
  const { searchParams } = new URL(req.url);
  const serviceEnv = searchParams.get('env') ?? 'prod';

  if (!authorization) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: DEF_HEADERS,
    });
  }

  const fetchToken = TOKEN_FETCHERS[service];

  if (fetchToken && action === 'login') {
    const credsResult = await fetchEnvCreds(org, site, authorization, serviceEnv);
    if (credsResult.error) {
      return handleError(credsResult);
    }

    const tokenResult = await fetchToken(credsResult.json);
    if (tokenResult.error) {
      return handleError(tokenResult);
    }
    console.log(tokenResult);
    return new Response(JSON.stringify(tokenResult.json), {
      status: tokenResult.status,
      headers: DEF_HEADERS,
    });
  }

  return handleError({ error: 'Route note supported.', status: 405 });
}
