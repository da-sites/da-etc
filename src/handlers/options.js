import { ALLOWED_DOMAINS } from '../utils/constants.js';
import { errorResponse } from '../utils/response.js';

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
        'Access-Control-Allow-Methods': 'HEAD, GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  return errorResponse(405, 'Method not allowed');
}
