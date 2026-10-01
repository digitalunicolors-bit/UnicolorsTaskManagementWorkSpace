Phase 32.14 - Logout failed-to-fetch hotfix
- Catch network failures during logout/logout-all.
- Always clear local auth session even when API is temporarily unavailable.
- Prevent Next.js runtime overlay from failed logout fetch.
- No database or API workflow changes.
