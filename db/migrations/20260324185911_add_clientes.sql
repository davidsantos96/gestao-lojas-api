/*
  Warnings:

  - You are about to drop the column `dataVenda` on the `vendas` table. All the data in the column will be lost.
  - You are about to drop the column `precoUnitario` on the `vendas` table. All the data in the column will be lost.
  - You are about to drop the column `produtoCat` on the `vendas` table. All the data in the column will be lost.
  - You are about to drop the column `produtoCor` on the `vendas` table. All the data in the column will be lost.
  - You are about to drop the column `produtoId` on the `vendas` table. All the data in the column will be lost.
  - You are about to drop the column `produtoNome` on the `vendas` table. All the data in the column will be lost.
  - You are about to drop the column `produtoSku` on the `vendas` table. All the data in the column will be lost.
  - You are about to drop the column `quantidade` on the `vendas` table. All the data in the column will be lost.
  - You are about to drop the column `valorTotal` on the `vendas` table. All the data in the column will be lost.
  - Added the required column `atualizadoEm` to the `vendas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalBruto` to the `vendas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalLiquido` to the `vendas` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusVenda" AS ENUM ('CONCLUIDA', 'CANCELADA');

-- DropForeignKey
ALTER TABLE "vendas" DROP CONSTRAINT "vendas_produtoId_fkey";

-- DropIndex
DROP INDEX "vendas_empresaId_dataVenda_idx";

-- DropIndex
DROP INDEX "vendas_empresaId_produtoId_idx";

-- AlterTable
ALTER TABLE "vendas" DROP COLUMN "dataVenda",
DROP COLUMN "precoUnitario",
DROP COLUMN "produtoCat",
DROP COLUMN "produtoCor",
DROP COLUMN "produtoId",
DROP COLUMN "produtoNome",
DROP COLUMN "produtoSku",
DROP COLUMN "quantidade",
DROP COLUMN "valorTotal",
ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "cliente" TEXT,
ADD COLUMN     "clienteId" TEXT,
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "desconto" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "formaPagamento" "FormaPagamento" NOT NULL DEFAULT 'DINHEIRO',
ADD COLUMN     "numero" SERIAL NOT NULL,
ADD COLUMN     "obs" TEXT,
ADD COLUMN     "parcelas" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "StatusVenda" NOT NULL DEFAULT 'CONCLUIDA',
ADD COLUMN     "totalBruto" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "totalLiquido" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "usuarioId" TEXT;

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "cpf_cnpj" TEXT,
    "nascimento" TIMESTAMP(3),
    "cidade" TEXT,
    "segmento" TEXT NOT NULL DEFAULT 'Regular',
    "obs" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_venda" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitario" DECIMAL(10,2) NOT NULL,
    "desconto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "itens_venda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientes_empresaId_idx" ON "clientes"("empresaId");

-- CreateIndex
CREATE INDEX "clientes_empresaId_nome_idx" ON "clientes"("empresaId", "nome");

-- CreateIndex
CREATE INDEX "itens_venda_vendaId_idx" ON "itens_venda"("vendaId");

-- CreateIndex
CREATE INDEX "itens_venda_produtoId_idx" ON "itens_venda"("produtoId");

-- CreateIndex
CREATE INDEX "vendas_clienteId_idx" ON "vendas"("clienteId");

-- CreateIndex
CREATE INDEX "vendas_empresaId_status_idx" ON "vendas"("empresaId", "status");

-- CreateIndex
CREATE INDEX "vendas_empresaId_criadoEm_idx" ON "vendas"("empresaId", "criadoEm");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_venda" ADD CONSTRAINT "itens_venda_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_venda" ADD CONSTRAINT "itens_venda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
