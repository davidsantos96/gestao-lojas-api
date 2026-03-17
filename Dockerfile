FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

RUN PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate

RUN npx tsc -p tsconfig.json

# Mostra toda a estrutura do dist para identificar o path correto
RUN find /app/dist -name "main.js" 2>/dev/null || echo "main.js nao encontrado"

RUN npm prune --omit=dev

EXPOSE 3000

# Usa o path correto conforme a estrutura gerada pelo tsc
CMD ["node", "/app/dist/src/main"]
