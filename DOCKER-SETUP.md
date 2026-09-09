# Unicolors Workspace - Local Docker Setup

This setup runs three services:

- `unicolors-web` - Next.js on http://localhost:3000
- `unicolors-api` - NestJS on http://localhost:4000
- `unicolors-db` - PostgreSQL 16, exposed on host port 5433 so it does not conflict with the existing Windows PostgreSQL on 5432

## Important behavior

- Docker uses a NEW, separate PostgreSQL volume. Your existing Windows PostgreSQL database is not modified.
- API startup runs `prisma migrate deploy`. This applies the project's already-existing migrations to the Docker database only. It does NOT create a new migration.
- `apps/api/.env` remains local and is loaded into the API container. `DATABASE_URL` is overridden so the API connects to Docker PostgreSQL.
- WhatsApp stays disabled with `WHATSAPP_ENABLED=false`.
- Local faster-whisper is installed inside the API image. Its models/audio storage are persisted in the `unicolors_api_storage` Docker volume.
- The first Whisper transcription can take longer because the model may download on first use.

## Start

From the repository root:

```powershell
docker compose build
docker compose up -d
```

## Status / logs

```powershell
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 web
```

## Stop without deleting data

```powershell
docker compose down
```

## Delete Docker database/storage too (destructive)

Only when you intentionally want a fresh Docker database:

```powershell
docker compose down -v
```
