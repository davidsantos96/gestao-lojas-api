FROM node:20-alpine

WORKDIR /app

# Instala dependências (incluindo devDeps para o build)
COPY package*.json ./
RUN npm ci --include=dev

# Copia o código fonte
COPY . .

# Gera o Prisma Client
RUN PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate

# Compila o TypeScript
RUN npx nest build

# Confirma que o dist foi gerado
RUN ls -la dist/

# Remove devDependencies para imagem final menor
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["node", "dist/main"]
