FROM denoland/deno:2.1.4

USER root

RUN apt-get update && apt-get install -y \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mkdir -p /app/uploads && chown -R deno:deno /app/uploads

COPY deno.json deno.lock* ./

RUN deno install

COPY . .

RUN deno cache src/main.ts

EXPOSE 3000

USER deno

CMD ["deno", "task", "start"]
