FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

COPY . .

ENTRYPOINT ["bun", "run", "packages/cli/index.ts"]
CMD ["scan", "--dashboard"]

EXPOSE 4567
