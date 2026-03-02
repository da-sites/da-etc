import corsRoute from '../routes/cors.js';

export default async function postHandler({ req, env }) {
  const url = new URL(req.url);

  if (url.pathname.startsWith('/cors')) return corsRoute({ req, env });

  return null;
}
