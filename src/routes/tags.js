import cleanHtml from '../utils/html.js';
import extractTags from '../utils/openai.js';

import { DEF_HEADERS } from '../utils/constants.js';

export default async function tagsRoute({ req, env }) {
  const { html } = await req.json();
  const cleaned = cleanHtml(html);
  const tags = await extractTags({ html: cleaned, env });
  const resp = new Response(JSON.stringify(tags), {
    status: 200,
    headers: DEF_HEADERS
  });
  return resp;
}