FROM node:20-bookworm-slim

# ffmpeg: converte a voz gerada (PCM) para nota de voz do WhatsApp (OGG/Opus)
# python3/make/g++: compilam o better-sqlite3 caso não exista binário pronto
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY prompts ./prompts
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
VOLUME /app/data

CMD ["node", "dist/index.js"]
