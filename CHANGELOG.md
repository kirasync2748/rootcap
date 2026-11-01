<!-- coderabbit-ai-generated:v1 -->

# Changelog

## 1.1.0

- Develop, build and release on Node.js 26.13.0 LTS; retain Node 24 support.
- Upgrade development dependencies and patch minimatch via an override. TypeScript stays on 5.9.3 to satisfy typescript-eslint's peer range.
- Update the npm allowScripts list to match installed lifecycle scripts.
- Validate JWT structure, challenge parameters, expiration claims and integer nonces; add scoped redeem-token verification.
- Require a configured secret outside development and bound production JSON request bodies.
- Make the widget form-associated, accessible, cancellable and resettable with automatic token expiry.
- Refresh website styling, install-command copying, keyboard focus, reduced motion and mobile presentation.
- Add tag-triggered npm trusted publishing after CI gates, with provenance and no long-lived npm token.
