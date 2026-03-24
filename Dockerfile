FROM node:20-slim

RUN apt-get update -y && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json nest-cli.json tsconfig.json ./
RUN npm ci --include=dev

COPY db ./db
COPY src ./src
RUN npx nest build

# Mostra onde o main.js foi gerado
RUN find /app/dist -name "main.js" && echo "=== build ok ==="

RUN npm prune --omit=dev

EXPOSE 3000

# Aplica migrations SQL pendentes e sobe a API
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
CMD ["./docker-entrypoint.sh"]
