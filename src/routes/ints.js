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

function formatConfig(json) {
  const config = json.config.data.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  const name = config['translation.service.name'];

  const service = { name, envs: {} };
  Object.keys(config).forEach((key) => {
    if (key.startsWith('translation.service.')) {
      const serviceKey = key.replace('translation.service.', '');

      const [env, prop] = serviceKey.split('.');
      if (env === 'name' || env === 'all') {
        return;
      }
      service.envs[env] ??= {};
      service.envs[env][prop] = config[key];
    }
  });

  return service;
}

async function fetchTradosToken(service) {
  const body = JSON.stringify({
    client_id: service.clientId,
    client_secret: service.clientSecret,
    grant_type: 'client_credentials',
    audience: service.audience,
  });

  const opts = { ...BASE_OPTS, body };
  const resp = await fetch(service.authEndpoint, opts);
  if (!resp.ok) {
    return { error: 'Could not get token', status: resp.status };
  }
  const json = await resp.json();
  return { json, status: resp.status };
}

function handleError({ error, status }) {
  return new Response(JSON.stringify(error), { status, headers: DEF_HEADERS });
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

  if (service === 'trados' && action === 'login') {
    const cfgResult = await fetchTranslateConfig(org, site, authorization);
    if (cfgResult.error) {
      return handleError(cfgResult);
    }

    const svcCfg = formatConfig(cfgResult.json);

    const tokenResult = await fetchTradosToken(svcCfg.envs[serviceEnv]);
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
