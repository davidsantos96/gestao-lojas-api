-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: dados de exemplo — Sistema de Controle de Lojas
-- Execute APÓS o 0001_init.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Empresa
INSERT INTO "empresas" ("id","nome","cnpj","email","telefone")
VALUES ('empresa-demo','Loja Centro','12.345.678/0001-99','contato@lojacentro.com.br','(11) 99999-0000')
ON CONFLICT DO NOTHING;

-- Usuário
INSERT INTO "usuarios" ("id","empresaId","nome","email","perfil")
VALUES ('usuario-demo','empresa-demo','Ana Lima','ana@lojacentro.com.br','ADMIN')
ON CONFLICT DO NOTHING;

-- Categorias de despesa
INSERT INTO "categorias_despesa" ("id","empresaId","nome","cor") VALUES
  ('cat-fornecedor','empresa-demo','Fornecedor','#4f8fff'),
  ('cat-aluguel',   'empresa-demo','Aluguel',   '#b478ff'),
  ('cat-utilities', 'empresa-demo','Utilities', '#f7c948'),
  ('cat-rh',        'empresa-demo','RH',        '#00d9a8'),
  ('cat-marketing', 'empresa-demo','Marketing', '#ff5b6b'),
  ('cat-outro',     'empresa-demo','Outro',     '#9299b0')
ON CONFLICT DO NOTHING;

-- Produtos
INSERT INTO "produtos" ("id","empresaId","sku","nome","categoria","cor","preco","custo","estoque","minimo") VALUES
  ('prod-cam-001','empresa-demo','CAM-001','Camiseta Básica P', 'VESTUARIO', 'Preto',  49.90,  22.00, 47, 10),
  ('prod-cam-002','empresa-demo','CAM-002','Camiseta Básica M', 'VESTUARIO', 'Preto',  49.90,  22.00,  8, 10),
  ('prod-cam-003','empresa-demo','CAM-003','Camiseta Básica G', 'VESTUARIO', 'Branco', 49.90,  22.00,  0, 10),
  ('prod-cal-001','empresa-demo','CAL-001','Calça Jeans 38',    'VESTUARIO', 'Azul',   149.90, 65.00, 23,  5),
  ('prod-cal-002','empresa-demo','CAL-002','Calça Jeans 40',    'VESTUARIO', 'Azul',   149.90, 65.00, 15,  5),
  ('prod-ten-001','empresa-demo','TEN-001','Tênis Casual 41',   'CALCADOS',  'Branco', 239.90,110.00,  4,  5),
  ('prod-ten-002','empresa-demo','TEN-002','Tênis Casual 42',   'CALCADOS',  'Preto',  239.90,110.00, 11,  5),
  ('prod-bon-001','empresa-demo','BON-001','Boné Aba Curva',    'ACESSORIOS','Preto',   59.90, 18.00, 32,  8),
  ('prod-bol-001','empresa-demo','BOL-001','Bolsa Feminina',    'ACESSORIOS','Vinho',  189.90, 75.00,  6,  8),
  ('prod-cin-001','empresa-demo','CIN-001','Cinto Couro 90cm',  'ACESSORIOS','Marrom',  79.90, 28.00, 19,  5)
ON CONFLICT DO NOTHING;

-- Movimentações de estoque
INSERT INTO "movimentacoes_estoque" ("id","empresaId","produtoId","usuarioId","tipo","quantidade","estoqueAntes","estoqueDepois","origem","criadoEm") VALUES
  ('mov-001','empresa-demo','prod-cam-001','usuario-demo','ENTRADA', 20, 27, 47,'Fornecedor A', '2026-03-15'),
  ('mov-002','empresa-demo','prod-cal-001','usuario-demo','SAIDA',   -3, 26, 23,'Venda #4821',  '2026-03-15'),
  ('mov-003','empresa-demo','prod-ten-002','usuario-demo','ENTRADA',  6,  5, 11,'Fornecedor B', '2026-03-14'),
  ('mov-004','empresa-demo','prod-bon-001','usuario-demo','SAIDA',   -5, 37, 32,'Venda #4820',  '2026-03-14'),
  ('mov-005','empresa-demo','prod-bol-001','usuario-demo','SAIDA',   -2,  8,  6,'Venda #4819',  '2026-03-13'),
  ('mov-006','empresa-demo','prod-cam-002','usuario-demo','AJUSTE',  -4, 12,  8,'Inventário',   '2026-03-13'),
  ('mov-007','empresa-demo','prod-cin-001','usuario-demo','ENTRADA', 10,  9, 19,'Fornecedor A', '2026-03-12')
ON CONFLICT DO NOTHING;

-- Contas a pagar
INSERT INTO "contas_pagar" ("id","empresaId","categoriaId","descricao","valor","vencimento","status") VALUES
  ('cp-001','empresa-demo','cat-fornecedor','Fornecedor Têxtil Alfa',  4800.00,'2026-03-20','PENDENTE'),
  ('cp-002','empresa-demo','cat-aluguel',   'Aluguel Loja Centro',     3200.00,'2026-04-05','PENDENTE'),
  ('cp-003','empresa-demo','cat-utilities', 'Energia Elétrica',         480.00,'2026-03-22','PENDENTE'),
  ('cp-004','empresa-demo','cat-rh',        'Folha de Pagamento Mar',  8500.00,'2026-04-05','PENDENTE'),
  ('cp-005','empresa-demo','cat-fornecedor','Fornecedor Calçados Beta',2200.00,'2026-03-10','PAGO'),
  ('cp-006','empresa-demo','cat-utilities', 'Internet / Telefonia',     290.00,'2026-03-18','VENCIDO')
ON CONFLICT DO NOTHING;

-- Contas a receber
INSERT INTO "contas_receber" ("id","empresaId","descricao","cliente","valor","vencimento","status") VALUES
  ('cr-001','empresa-demo','Parcelamento Venda #4790','Maria Santos',   1200.00,'2026-03-18','PENDENTE'),
  ('cr-002','empresa-demo','Parcelamento Venda #4750','Carlos Oliveira', 800.00,'2026-03-25','PENDENTE'),
  ('cr-003','empresa-demo','Venda Atacado #210',      'Boutique Nova',  5400.00,'2026-03-30','PENDENTE'),
  ('cr-004','empresa-demo','Parcelamento Venda #4712','Ana Beatriz',     640.00,'2026-03-08','RECEBIDO'),
  ('cr-005','empresa-demo','Parcelamento Venda #4701','Pedro Lima',      380.00,'2026-03-01','VENCIDO')
ON CONFLICT DO NOTHING;

-- Lançamentos
INSERT INTO "lancamentos" ("id","empresaId","tipo","descricao","valor","data") VALUES
  ('lan-001','empresa-demo','RECEITA','Vendas balcão — 1ª quinzena',28000.00,'2026-03-15'),
  ('lan-002','empresa-demo','RECEITA','Venda atacado Boutique Nova', 5400.00,'2026-03-12'),
  ('lan-003','empresa-demo','DESPESA','Reposição camisetas',         2640.00,'2026-03-10'),
  ('lan-004','empresa-demo','DESPESA','Anúncios Instagram',           800.00,'2026-03-05')
ON CONFLICT DO NOTHING;
