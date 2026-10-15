import { errorResponse } from '../utils/response.js';

export default async function corsRoute({ req }) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return errorResponse(400, 'Missing target URL');
  }

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(targetUrl);

    if (!['http:', 'https:'].includes(new URL(decodedUrl).protocol)) {
      return errorResponse(400, 'Invalid target URL');
    }
  } catch {
    return errorResponse(400, 'Invalid target URL');
  }

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
    headers: responseHeaders
  });
}
