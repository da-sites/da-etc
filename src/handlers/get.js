import corsRoute from '../routes/cors.js';
import intRoute from '../routes/ints.js';

export default async function getHandler({ req, env }) {
  const { pathname } = new URL(req.url);

  if (pathname.startsWith('/cors')) return corsRoute({ req, env });

  // HLX6-flavored APIs are org-scoped
  const [org, _, site, api, service, action] = pathname.slice(1).split('/');

  // Only `status` is safe over GET: it never returns a secret, unlike `login`, which must
  // stay POST-only since GET requests can be cached, prefetched, or logged by intermediaries.
  if (api === 'integrations' && action === 'status') {
    return intRoute({
      req, env, org, site, service, action,
    });
  }

  return null;
}
