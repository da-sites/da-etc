import corsRoute from '../routes/cors.js';
import intRoute from '../routes/ints.js';

export default async function getHandler({ req, env }) {
  const { pathname } = new URL(req.url);

  if (pathname.startsWith('/cors')) return corsRoute({ req, env });

  // HLX6-flavored APIs are org-scoped
  const [org, _, site, api, service, action] = pathname.slice(1).split('/');

  if (api === 'integrations') {
    return intRoute({
      req, env, org, site, service, action,
    });
  }

  return null;
}
