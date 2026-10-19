# Magik OS edit engine. Build from this folder:  docker build -t magik-engine .
# Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SECRET_KEY and ANTHROPIC_API_KEY.
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-inter fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-workspace
COPY src ./src
COPY skills ./skills
COPY music ./music
COPY sfx ./sfx
COPY assets ./assets
COPY motion ./motion

ENV NODE_ENV=production ENGINE_WORK_DIR=/tmp/magik-engine
USER node
CMD ["node", "src/worker.ts"]
