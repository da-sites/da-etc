import { DEF_HEADERS } from '../utils/constants.js';

export default async function corsRoute({ req }) {
  console.log('balls');
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing target URL' }), {
      status: 400,
      headers: DEF_HEADERS
    });
  }

  const decodedUrl = decodeURIComponent(targetUrl);

  const headers = new Headers(req.headers);
  headers.delete('host');

  const response = await fetch(decodedUrl, {
    method: req.method,
    headers,
    body: req.body
  });

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
