Phase 32.6 - Refresh token uniqueness hotfix

Fixes Prisma P2002 unique constraint violation on refresh_tokens.tokenHash.
Root cause: rotating a refresh token within the same JWT timestamp second could generate an identical JWT because the payload/secret/iat/exp were otherwise the same.

Change:
- Add a cryptographically unique jti (randomUUID) to every newly issued refresh JWT, both at login and during token rotation.
- Existing refresh tokens remain compatible; no database migration is required.
