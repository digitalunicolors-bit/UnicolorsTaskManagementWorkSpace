FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable \
    && corepack prepare pnpm@11.23.0 --activate \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 \
       python3-venv \
       libgomp1 \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/whisper-venv \
    && /opt/whisper-venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/whisper-venv/bin/pip install --no-cache-dir faster-whisper

WORKDIR /app

COPY apps/api/package.json apps/api/pnpm-lock.yaml apps/api/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY apps/api/ ./

# Prisma 7 config resolves DATABASE_URL while generating the client.
# This value is build-only; docker-compose overrides it at runtime.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build?schema=public
ENV WHISPER_PYTHON_PATH=/opt/whisper-venv/bin/python

RUN pnpm exec prisma generate
RUN pnpm build

EXPOSE 4000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && if [ -f dist/src/main.js ]; then exec node dist/src/main.js; elif [ -f dist/main.js ]; then exec node dist/main.js; else echo 'API build output not found.' >&2; find dist -maxdepth 3 -name main.js -print; exit 1; fi"]
