FROM denoland/deno:2.1.4

WORKDIR /app

COPY deno.json deno.lock* ./

RUN deno install

COPY . .

RUN deno cache src/main.ts

EXPOSE 3000

USER deno

CMD ["deno", "task", "start"]
