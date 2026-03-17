FROM node:20-alpine

WORKDIR /app

# Instala dependências incluindo devDeps (precisa do @nestjs/cli e typescript)
COPY package*.json ./
RUN npm ci --include=dev

# Copia código fonte
COPY . .

# Gera o Prisma Client
RUN PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate

# Compila TypeScript com tsc diretamente (mais confiável que nest build no Docker)
RUN npx tsc -p tsconfig.json

# Confirma que o dist foi gerado com caminho absoluto
RUN ls -la /app/dist/ && echo "✓ dist gerado com sucesso"

# Remove devDependencies da imagem final
RUN npm prune --omit=dev

# Confirma que dist ainda existe após prune
RUN ls -la /app/dist/main.js && echo "✓ dist/main.js presente"

EXPOSE 3000

CMD ["node", "/app/dist/main"]
