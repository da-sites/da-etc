import tagsRoute from '../routes/tags.js';

export default async function postHandler({ req, env }) {
  const { pathname } = new URL(req.url);

  if (pathname.startsWith('/tags')) return tagsRoute({ req, env });

  return null;
}