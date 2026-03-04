FROM oven/bun:1-slim
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile --production
COPY src/ src/
COPY index.ts ./
EXPOSE 3000
CMD ["bun", "run", "index.ts"]
