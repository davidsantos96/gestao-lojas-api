-- Migration: 0002_add_senha_usuario
-- Adiciona coluna senha (nullable) à tabela usuarios
-- Aplique em bancos existentes criados com 0001_init.sql

ALTER TABLE "usuarios"
  ADD COLUMN IF NOT EXISTS "senha" TEXT;
