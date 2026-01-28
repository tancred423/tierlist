FROM denoland/deno:2.1.4 AS base

USER root

RUN apt-get update && apt-get install -y \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

FROM base AS builder

WORKDIR /app

COPY deno.json deno.lock* ./
RUN deno install

COPY . .
RUN deno cache src/main.ts

FROM base AS runner

WORKDIR /app

RUN mkdir -p /app/uploads

COPY --from=builder /app .
COPY --from=builder /root/.cache/deno /root/.cache/deno

EXPOSE 3000

CMD ["deno", "task", "start"]
