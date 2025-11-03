import postHandler from './handlers/post.js';

import { DEF_HEADERS } from './utils/constants.js';

export default {
  async fetch(req, env) {
    try {
      switch (req.method) {
        case 'OPTIONS':
          return new Response('', { status: 204, headers: DEF_HEADERS });
        case 'POST':
          return await postHandler({ req, env });
        case 'GET':
          return new Response('Method not allowed', { status: 405, headers: DEF_HEADERS });
        default:
          return new Response('Method not allowed', { status: 405, headers: DEF_HEADERS });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: DEF_HEADERS
      });
    }
  }
};