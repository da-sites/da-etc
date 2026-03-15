import optionsHandler from './handlers/options.js';
import postHandler from './handlers/post.js';
import getHandler from './handlers/get.js';

import { DEF_HEADERS } from './utils/constants.js';

export default {
  async fetch(req, env) {
    try {
      switch (req.method) {
        case 'OPTIONS':
          return await optionsHandler({ req, env });
        case 'POST':
          return await postHandler({ req, env });
        case 'PUT':
          return await postHandler({ req, env });
        case 'HEAD':
          return await getHandler({ req, env });
        case 'GET':
          return await getHandler({ req, env });
        case 'DELETE':
          return await postHandler({ req, env });
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
