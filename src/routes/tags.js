import cleanHtml from '../utils/html.js'
import extractTags from '../utils/openai.js'

import { DEF_HEADERS } from '../utils/constants.js'
import { errorResponse } from '../utils/response.js'

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
    headers: DEF_HEADERS
  });
}
