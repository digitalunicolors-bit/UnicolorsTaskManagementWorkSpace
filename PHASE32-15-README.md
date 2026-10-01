Phase 32.15 - API dist main path fix
- Restrict Nest build input to apps/api/src
- Set build rootDir to ./src
- Ensures output is dist/main.js instead of dist/src/main.js
- Fixes MODULE_NOT_FOUND when Nest tries to start dist/main
