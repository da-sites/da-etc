import { ALLOWED_DOMAINS } from '../utils/constants.js';

export default async function optionsHandler({ req }) {
  const origin = req.headers.get('origin');
  if (!origin) return null;

  const { hostname } = new URL(origin);
  const domain = hostname.split('.').slice(-2).join('.');

  if (ALLOWED_DOMAINS.includes(domain)) {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'HEAD, GET, POST, PUT',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  return new Response('Method not allowed', { status: 405, headers: DEF_HEADERS });
}
