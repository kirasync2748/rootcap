# Changelog

## 1.2.0

- Add the optional `rootcap/server` Node HTTP adapter with exact routing, bounded JSON, method guards, consistent errors and no-store responses across development, Vercel and self hosting.
- Verify redeem tokens with a fixed scope on the backend before both demo forms report success; add accessible submission feedback.
- Add widget `execute()`, `getResponse()`, required/disabled attributes and progress/error/expiry events; validate challenge responses and clean up failed worker startup.
- Honor LIB_DIR for server bundle loading, correctly decode streamed UTF-8, block static symlink escapes and return 404 for missing assets.
- Stop dashboard polling when leaving the page and ignore malformed URL fragments.
- Correct scoped redemption examples and reject non-string scope generation options at runtime.
- Preserve Node >=24 support, existing repository links and stateless reusable token behavior.

### Follow-up fixes

- Serve the standalone demo shell for extensionless routes, while keeping missing
  assets and unknown API routes at 404.
- Reject parent-directory traversal on Windows and POSIX in both self-host servers.
- Clarify setup, scoped token verification, package entry points, and release steps.

## 1.1.0

- Develop, build and release on Node.js 26.13.0 LTS; retain Node 24 support.
- Upgrade development dependencies and patch minimatch via an override. TypeScript stays on 5.9.3 to satisfy typescript-eslint's peer range.
- Update the npm allowScripts list to match installed lifecycle scripts.
- Validate JWT structure, challenge parameters, expiration claims and integer nonces; add scoped redeem-token verification.
- Require a configured secret outside development and bound production JSON request bodies.
- Make the widget form-associated, accessible, cancellable and resettable with automatic token expiry.
- Refresh website styling, install-command copying, keyboard focus, reduced motion and mobile presentation.
- Add tag-triggered npm trusted publishing after CI gates, with provenance and no long-lived npm token.


## 1.0.0

- initial release.
