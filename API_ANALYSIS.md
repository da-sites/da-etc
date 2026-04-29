# AEM Admin API Analysis: Legacy (helix-admin) vs New (helix-api-service)

## Overview

Adobe is migrating the AEM Admin API from a **legacy service** at `admin.hlx.page` (codebase: `helix-admin`) to a **new service** at `api.aem.live` (codebase: `helix-api-service`). This is internally referred to as "hlx6" / the "API upgrade".

The new API is **not a proxy** in front of helix-admin -- it is a completely separate codebase (`helix-api-service`) with its own router, request handling, and storage layer. The new service introduces a **source bus** for direct document management, a **versioning system**, and a restructured URL scheme.

### Codebases

| Codebase | Host | Description |
|----------|------|-------------|
| `helix-admin` | `admin.hlx.page` | Legacy admin service. Monolithic handler dispatch via `PathInfo` constructor. |
| `helix-api-service` | `api.aem.live` | New admin service. Tree-based router, `AdminContext` wrapper, source bus. |
| `aem-sidekick` | Browser extension | Client that talks to both APIs, controlled by `apiUpgrade` flag. |

### Migration Timeline (aem-sidekick git history)

| Commit | Description |
|--------|-------------|
| `7f80854` / `77dd085` | Initial support for new admin API (#702) |
| `e67a8b8` | Reverted hlx6 admin support due to regression (#762) |
| `52f17c5` | Re-added support for new admin API (#765) |
| `8d2047e` | Fixed: use new admin API if configured (#777) |

---

## How the Upgrade is Detected (Sidekick)

1. The sidekick calls the `sidekick/config.json` endpoint on startup (`aem-sidekick/src/extension/app/store/site.js:220-229`)
2. If the response includes the header `x-api-upgrade-available: true`, the `apiUpgrade` flag is set to `true`
3. Once enabled, all subsequent Admin API calls use the new `api.aem.live` origin
4. The flag is persisted in the site config and propagated to all API calls

---

## Architecture Comparison

### Legacy (`helix-admin`)

- **Entry point**: `src/index.js` — handler map keyed by route name
- **Routing**: `PathInfo` constructor parses `/{route}/{org}/{site}/{branch}/...` from suffix
- **Config loading**: inline in `doRun()`, loads site and org config from config bus
- **Auth**: `authenticate()` + `authorize()` called inline before handler dispatch
- **Middleware**: `wrap().with()` chain: `sqsEventAdapter → addCommonResponseHeaders → contentEncode → bodyData → secrets → helixStatus`

### New (`helix-api-service`)

- **Entry point**: `src/index.js` — tree-based `Router` with explicit route registration
- **Routing**: `Router.match()` decomposes path via tree traversal, extracts named params (`:org`, `:site`, `:ref`, `:topic`, `:profile`)
- **Config loading**: `AdminContext.loadConfig(info)` — lazy-loaded, cached
- **Auth**: `context.authenticate(info)` + `context.authorize(info)` on AdminContext
- **Middleware**: `wrap().with()` chain: `catchAll → adminContext → sqsEventAdapter → commonResponseHeaders → contentEncode → bodyData → secrets → helixStatus`

---

## Complete Route Map: Legacy → New

### Core Content Operations

| Operation | Legacy (`admin.hlx.page`) | New (`api.aem.live`) | Methods | Notes |
|-----------|--------------------------|----------------------|---------|-------|
| **Status** | `/status/{owner}/{repo}/{ref}{path}` | `/{org}/sites/{site}/status/{path}` | GET | Same response shape |
| **Preview** | `/preview/{owner}/{repo}/{ref}{path}` | `/{org}/sites/{site}/preview/{path}` | GET/POST/DELETE | GET=status, POST=preview, DELETE=unpreview |
| **Live/Publish** | `/live/{owner}/{repo}/{ref}{path}` | `/{org}/sites/{site}/live/{path}` | GET/POST/DELETE | GET=status, POST=publish, DELETE=unpublish |
| **Bulk Preview** | `/preview/{owner}/{repo}/{ref}/*` | `/{org}/sites/{site}/preview/*` | POST | Body: `{paths, delete}` |
| **Bulk Publish** | `/live/{owner}/{repo}/{ref}/*` | `/{org}/sites/{site}/live/*` | POST | Body: `{paths, delete}` |
| **Code** | `/code/{owner}/{repo}/{ref}{path}` | `/{org}/repos/{site}/code/{ref}{path}` | GET/POST/DELETE | Note: uses `repos` not `sites` |

### Authentication

| Operation | Legacy (`admin.hlx.page`) | New (`api.aem.live`) | Methods |
|-----------|--------------------------|----------------------|---------|
| **Login** | `/login/{owner}/{repo}/{ref}` | `/login?org={org}&site={site}` | GET |
| **Logout** | `/logout/{owner}/{repo}/{ref}` | `/logout?org={org}&site={site}` | GET |
| **Profile** | `/profile/{owner}/{repo}/{ref}` | `/profile?org={org}&site={site}` | GET/POST |
| **Auth Callbacks** | `/auth/*` (in handler map) | `/auth/*` | GET |
| **JWKS** | — | `/auth/discovery/keys` | GET |
| **Site-scoped Login** | — | `/{org}/sites/{site}/login` | GET |

### Configuration

| Operation | Legacy (`admin.hlx.page`) | New (`api.aem.live`) | Methods |
|-----------|--------------------------|----------------------|---------|
| **Sidekick Config** | `/sidekick/{owner}/{repo}/{ref}/config.json` | `/{org}/sites/{site}/sidekick` | GET |
| **Site Config** | `/config/{owner}/{repo}/{ref}` | `/{org}/sites/{site}/config.json` | GET/PUT/POST/DELETE |
| **Site Config (nested)** | — | `/{org}/sites/{site}/config/{path}` | GET/PUT/POST/DELETE |
| **Org Config** | `/config/{owner}.json` | `/{org}/config.json` | GET/PUT/POST/DELETE |
| **Org Config (nested)** | — | `/{org}/config/{path}` | GET/PUT/POST/DELETE |
| **Aggregated Config** | — | `/{org}/aggregated/{site}/config.json` | GET |
| **Profile Config** | — | `/{org}/profiles/{profile}/config.json` | GET/PUT/POST/DELETE |
| **Org Profiles** | — | `/{org}/profiles` | GET |
| **Org Sites** | — | `/{org}/sites` | GET |

### Discovery & Lookup

| Operation | Legacy (`admin.hlx.page`) | New (`api.aem.live`) | Methods |
|-----------|--------------------------|----------------------|---------|
| **Discover** | `/discover?url={url}` | `/discover?url={url}` | GET/POST/DELETE |

### Jobs

| Operation | Legacy (`admin.hlx.page`) | New (`api.aem.live`) | Methods |
|-----------|--------------------------|----------------------|---------|
| **Get/List Jobs** | `/job/{owner}/{repo}/{ref}/{topic}/{name}` | `/{org}/sites/{site}/jobs/{topic}/{name}` | GET |
| **Job Details** | `/job/{owner}/{repo}/{ref}/{topic}/{name}/details` | `/{org}/sites/{site}/jobs/{topic}/{name}/details` | GET |
| **Stop Job** | — | `/{org}/sites/{site}/jobs/{topic}/{name}` | DELETE |
| **Create Test Job** | — | `/{org}/sites/{site}/jobs/test` | POST |

### Other

| Operation | Legacy (`admin.hlx.page`) | New (`api.aem.live`) | Methods |
|-----------|--------------------------|----------------------|---------|
| **Cache Purge** | `/cache/{owner}/{repo}/{ref}{path}` | `/{org}/sites/{site}/cache/{path}` | varies |
| **Content Proxy** | `/contentproxy/{owner}/{repo}/{ref}{path}` | `/{org}/sites/{site}/contentproxy/{path}` | varies |
| **Index** | `/index/{owner}/{repo}/{ref}{path}` | `/{org}/sites/{site}/index/{path}` | varies |
| **Log** | `/log/{owner}/{repo}/{ref}` | `/{org}/sites/{site}/log` | varies |
| **Media** | `/media/{owner}/{repo}/{ref}{path}` | `/{org}/sites/{site}/media/{path}` | varies |
| **Sitemap** | `/sitemap/{owner}/{repo}/{ref}{path}` | `/{org}/sites/{site}/sitemap/{path}` | varies |
| **Snapshot** | `/snapshot/{owner}/{repo}/{ref}{path}` | `/{org}/sites/{site}/snapshots/{path}` | **405 (NYI)** |
| **PSI** | `/psi/{owner}/{repo}/{ref}` | — | **Removed** |
| **Cron** | `/cron/...` | — | **Removed from routes** |

---

## New-Only Endpoints (not in legacy)

### Source Bus (`/{org}/sites/{site}/source/{path}`)

The source bus is a **brand new concept** in the new API. It provides direct CRUD access to the underlying source documents stored in S3, bypassing the content proxy (OneDrive/Google Drive). This is the foundation for the new content management architecture.

| Operation | URL | Method | Description |
|-----------|-----|--------|-------------|
| **Get document** | `/{org}/sites/{site}/source/{path}` | GET | Retrieve source document from S3 |
| **Head document** | `/{org}/sites/{site}/source/{path}` | HEAD | Get metadata only |
| **Create/Update (with image interning)** | `/{org}/sites/{site}/source/{path}` | POST | Store document, intern external images to media bus |
| **Create/Update (no image interning)** | `/{org}/sites/{site}/source/{path}` | PUT | Store document as-is, or copy/move with `source` param |
| **Delete document** | `/{org}/sites/{site}/source/{path}` | DELETE | Remove from source bus |
| **List folder** | `/{org}/sites/{site}/source/{path}/` | GET | List folder contents (trailing slash) |
| **Create folder** | `/{org}/sites/{site}/source/{path}/` | POST | Create folder marker |
| **Delete folder** | `/{org}/sites/{site}/source/{path}/` | DELETE | Recursively delete folder |
| **Copy/Move** | `/{org}/sites/{site}/source/{dest}` | PUT | With `source={srcPath}`, optional `move=true`, `collision=overwrite` |

#### Source Bus Storage

- **S3 key format**: `{org}/{site}{resourcePath}` (e.g. `adobe/aem-boilerplate/index.md`)
- **Supported content types**: `.html` (text/html), `.json` (application/json), `.gif`, `.ico`, `.jpeg`, `.jpg`, `.mp4`, `.pdf`, `.png`, `.svg`
- **HTML validation**: Must contain a `<main>` element; external images are interned to media bus on POST
- **JSON validation**: Must be valid JSON
- **Media validation**: Validated against known media types, max 20MB images
- **Conditional headers**: Supports `If-Match` and `If-None-Match` for optimistic concurrency
- **Document IDs**: Each source document gets a ULID-based `doc-id` in S3 metadata

#### Folder Listing Response

```json
[
  { "name": "subfolder", "content-type": "application/folder" },
  { "name": "page.html", "size": 1234, "content-type": "text/html", "last-modified": "2025-01-01T00:00:00.000Z" }
]
```

### Versioning (`/{org}/sites/{site}/source/{path}/.versions`)

The new API includes a **document versioning system** backed by S3 copies keyed by ULID.

| Operation | URL | Method | Description |
|-----------|-----|--------|-------------|
| **List versions** | `/{org}/sites/{site}/source/{path}/.versions` | GET | List all versions of a document |
| **Get version** | `/{org}/sites/{site}/source/{path}/.versions/{versionId}` | GET | Retrieve a specific version |
| **Create version** | `/{org}/sites/{site}/source/{path}/.versions` | POST | Create a named version snapshot. Body: `{operation, comment}` |

#### Version List Response

```json
[
  {
    "version": "01KJDB3QXBAFRRXWRV3W8DBD9R",
    "doc-last-modified": "2026-02-26T16:02:12.000Z",
    "doc-last-modified-by": "joe@bloggs.org",
    "doc-path-hint": "/path/to/file.html",
    "version-date": "2026-02-26T16:04:36.000Z",
    "version-by": "joe@bloggs.org",
    "version-operation": "preview"
  },
  {
    "version": "01KJDB2TW1AWCD1P7TMRZMBCT1",
    "doc-last-modified": "2026-02-26T16:04:06.000Z",
    "doc-last-modified-by": "joe@bloggs.org, harry@bloggs.org",
    "doc-path-hint": "/path/to/file.html",
    "version-by": "mel@bloggs.org",
    "version-date": "2026-02-26T16:04:06.000Z",
    "version-operation": "version",
    "version-comment": "ready for approval"
  }
]
```

Versions are also **automatically created** during copy operations when `collision=overwrite` is used — the existing document is versioned before being overwritten.

---

## Key Structural Differences

| Aspect | Legacy (`admin.hlx.page`) | New (`api.aem.live`) |
|--------|--------------------------|----------------------|
| **Origin** | `admin.hlx.page` | `api.aem.live` |
| **Codebase** | `helix-admin` | `helix-api-service` |
| **URL pattern** | `/{api}/{owner}/{repo}/{ref}{path}` | `/{org}/sites/{site}/{api}/{path}` |
| **Branch/ref in URL** | Yes — always in path | No — removed from path (defaults to `main`; code uses `/{org}/repos/{site}/code/{ref}`) |
| **Naming** | `owner` / `repo` | `org` / `site` |
| **Auth endpoints** | Path-based: `/{api}/{owner}/{repo}/{ref}` | Query-param based: `/{api}?org={org}&site={site}` |
| **Sidekick config** | `/sidekick/{o}/{r}/{ref}/config.json` | `/{org}/sites/{site}/sidekick` |
| **Job endpoint** | `job` (singular) | `jobs` (plural), with `/{topic}/{name}` in path |
| **Version query param** | `hlx-admin-version` | `aem-api-version` |
| **Auth token header** | `x-auth-token` | `x-auth-token` (same) |
| **Source documents** | Via content proxy (OneDrive/GDrive) | **Source bus** (direct S3) + content proxy fallback |
| **Versioning** | None | `.versions` sub-resource on source bus |
| **Document storage** | Content bus (contentBusId-based) | Source bus (`{org}/{site}{path}`) |
| **Config management** | Single `/config/{owner}.json` | Hierarchical: org config, site config, profile config, aggregated config |
| **Routing** | Constructor-based `PathInfo` | Tree-based `Router` with named params |
| **Snapshots** | Supported | Route exists but returns 405 (NYI) |
| **PSI (PageSpeed Insights)** | Supported | Removed |
| **Cron** | Supported (with schedule handler) | Not in routes |
| **CORS headers** | Echo origin + expose `x-error, x-error-code` | Same pattern |

---

## URL Construction in the Sidekick

The routing logic in `aem-sidekick/src/extension/utils/admin.js:42-79`:

```
if apiUpgrade is true:
  origin = https://api.aem.live
  if api in ['login', 'logout', 'profile']:
    path = /{api}?org={org}&site={site}
  else:
    if api == 'job': rename to 'jobs'
    path = /{org}/sites/{site}/{api}{resourcePath}
else:
  origin = https://admin.hlx.page
  path = /{api}/{owner}/{repo}/{ref}{resourcePath}

Special: 'discover' always uses apiUpgrade: true (hardcoded)
```

---

## Auth Header Rules (Sidekick Extension)

Defined in `aem-sidekick/src/extension/auth.js`:

| Origin | Regex Filter |
|--------|-------------|
| **Legacy** | `^https://admin.hlx.page/(config/{owner}\.json\|[a-z]+/{owner}/.*)` |
| **New** | `^https://api.aem.live/({owner}/.*\|profile\?org\={owner}\&)` |

Both use the same `x-auth-token` value per org.

---

## Response Shapes

### Status Response (both APIs)

```json
{
  "webPath": "/",
  "resourcePath": "/index.md",
  "live": {
    "url": "https://main--aem-boilerplate--adobe.aem.live/",
    "status": 200,
    "contentBusId": "helix-content-bus/content-bus-id/live/index.md",
    "contentType": "text/plain; charset=utf-8",
    "lastModified": "Tue, 19 Dec 2023 15:42:45 GMT",
    "sourceLocation": "onedrive:/drives/drive-id/items/item-id",
    "sourceLastModified": "Wed, 01 Nov 2023 17:22:52 GMT",
    "permissions": ["read", "write"]
  },
  "preview": { /* same shape as live */ },
  "edit": {
    "status": 200, "url": "https://...", "name": "bar.docx",
    "contentType": "application/...",
    "folders": [{ "name": "...", "url": "...", "path": "/..." }],
    "lastModified": "...", "sourceLocation": "onedrive:/drives/..."
  },
  "code": { "status": 400, "permissions": ["delete", "read", "write"] },
  "links": {
    "status": "https://.../status/...",
    "preview": "https://.../preview/...",
    "live": "https://.../live/...",
    "code": "https://.../code/..."
  }
}
```

### Profile Response

```json
{
  "status": 200,
  "profile": {
    "email": "foo@example.com",
    "name": "Peter Parker",
    "picture": "https://...",
    "iat": 111, "exp": 222, "ttl": 333
  },
  "links": { "logout": "https://api.aem.live/logout" }
}
```

### Bulk Job Response

```json
{
  "status": 202,
  "job": { "topic": "topic", "name": "123", "state": "created", "startTime": "..." }
}
```

### Job Status / Details Response

```json
{
  "topic": "topic", "name": "123", "state": "complete",
  "progress": { "total": 10, "processed": 10, "failed": 0 },
  "data": {
    "resources": [
      { "status": 200, "path": "/foo" },
      { "status": 200, "path": "/bar" }
    ]
  }
}
```

---

## Error Handling

| Mechanism | Legacy | New |
|-----------|--------|-----|
| `x-error` header | Yes | Yes |
| `x-error-code` header | Yes | Yes |
| `x-severity` header | — | Yes (in status lookups) |
| Rate limiting (429) | Yes | Yes |
| OneDrive throttling (503) | Yes | Yes |
| Upgrade signal | `x-api-upgrade-available: true` | — (is the target) |
| Unauthenticated | 401 | 401 (enforced at router level for all org-scoped routes) |
| Unauthorized | 403 | 403 via `AccessDeniedError` |

---

## Permissions Model

The new API uses a granular permission system with assertions like:

- `preview:read`, `preview:write`, `preview:delete`, `preview:delete-forced`
- `live:read`, `live:write`, `live:delete`, `live:delete-forced`
- `code:read`, `code:delete`, `code:delete-forced`
- `edit:read`
- `job:read`, `job:write`, `job:list`, `job:test`
- `discover:write`

The legacy API uses a similar but less granular role-mapping system.

---

## Key Source Files

### aem-sidekick (client)

| File | Purpose |
|------|---------|
| `src/extension/utils/admin.js` | `createAdminUrl()` and `callAdmin()` — core API routing |
| `src/extension/app/utils/admin-client.js` | `AdminClient` class — high-level API methods |
| `src/extension/auth.js` | Auth token and CORS header management for both origins |
| `src/extension/app/store/site.js` | Site store — detects `apiUpgrade` from response header |
| `src/extension/content.js` | Passes `apiUpgrade` flag to sidekick config |
| `src/extension/project.js` | `getProjectEnv()` — fetches sidekick config |
| `src/extension/url-cache.js` | Discovery calls (always use new API) |
| `src/extension/actions.js` | Login/logout flow using `createAdminUrl()` |

### helix-admin (legacy server)

| File | Purpose |
|------|---------|
| `src/index.js` | Entry point, handler map, `doRun()` dispatch |
| `src/support/PathInfo.js` | URL parsing: `/{route}/{org}/{site}/{branch}/...` |
| `src/auth/authzn.js` | Authentication and authorization |
| `src/preview/handler.js` | Preview handler |
| `src/live/handler.js` | Live/publish handler |
| `src/status/handler.js` | Status handler |

### helix-api-service (new server)

| File | Purpose |
|------|---------|
| `src/index.js` | Entry point, Router registration, all route definitions |
| `src/router/router.js` | Tree-based path router |
| `src/support/RequestInfo.js` | URL decomposition, path computation, link generation |
| `src/support/AdminContext.js` | Central context (config loading, auth, clients) |
| `src/source/handler.js` | **NEW**: Source bus CRUD handler |
| `src/source/versions.js` | **NEW**: Document versioning |
| `src/source/folder.js` | **NEW**: Folder operations (list, create, delete) |
| `src/source/put.js` | **NEW**: Copy/move operations |
| `src/source/utils.js` | Source bus utilities, HTML validation, media interning |
| `src/preview/handler.js` | Preview handler (GET/POST/DELETE) |
| `src/live/handler.js` | Live/publish handler (GET/POST/DELETE) |
| `src/status/status.js` | Status with edit lookup (web2edit, edit2web) |
| `src/config/org-handler.js` | Org-level config handler |
| `src/config/site-handler.js` | Site-level config handler |
| `src/config/aggregated-handler.js` | Aggregated config handler |
| `src/config/profile-handler.js` | Profile config handler |
| `src/login/handler.js` | Login/logout/auth with multi-IDP support |
| `src/profile/handler.js` | Profile handler |
| `src/job/handler.js` | Job handler with typed job classes |
| `src/code/handler.js` | Code handler (uses `repos` not `sites`) |
| `src/sidekick/handler.js` | Sidekick config handler |
| `src/discover/handler.js` | Discovery handler (GET/POST/DELETE) |
| `src/wrappers/catch-all.js` | Error catching wrapper |
