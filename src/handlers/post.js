import corsRoute from '../routes/cors.js';
import tagsRoute from '../routes/tags.js';

export default async function postHandler({ req, env }) {
  const { pathname } = new URL(req.url);

  if (pathname.startsWith('/cors')) return corsRoute({ req, env });

  if (pathname.startsWith('/tags')) return tagsRoute({ req, env });

  return null;
}
