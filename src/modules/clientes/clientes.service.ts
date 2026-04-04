import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Cliente } from '../../database/entities';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ClientesService {
  constructor(private db: DatabaseService) {}

  async create(dto: CreateClienteDto, empresaId: string) {
    const id = randomUUID();
    const row = await this.db.queryOne<Cliente>(
      `INSERT INTO clientes
         (id, "empresaId", nome, email, telefone, cpf_cnpj, nascimento, cidade, segmento, obs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        id, empresaId, dto.nome, dto.email ?? null, dto.telefone ?? null,
        dto.cpf_cnpj ?? null, dto.nascimento ? new Date(dto.nascimento) : null,
        dto.cidade ?? null, dto.segmento ?? 'Regular', dto.obs ?? null,
      ],
    );
    return row;
  }

  async findAll(empresaId: string) {
    const clientes = await this.db.query<Cliente & { vendas_count: string }>(
      `SELECT c.*, COUNT(v.id) AS vendas_count
       FROM clientes c
       LEFT JOIN vendas v ON v."clienteId" = c.id AND v."empresaId" = $1
       WHERE c."empresaId" = $1
       GROUP BY c.id
       ORDER BY c.nome ASC`,
      [empresaId],
    );

    // Gasto total por cliente (apenas vendas concluídas)
    const gastos = await this.db.query<{ clienteId: string; total: string }>(
      `SELECT "clienteId", SUM("totalLiquido") AS total
       FROM vendas
       WHERE "empresaId" = $1 AND "clienteId" IS NOT NULL AND status = 'CONCLUIDA'
       GROUP BY "clienteId"`,
      [empresaId],
    );

    const gastoMap = new Map(gastos.map(g => [g.clienteId, Number(g.total)]));

    return clientes.map(c => ({
      ...c,
      compras:      Number(c.vendas_count),
      gasto_total:  gastoMap.get(c.id) ?? 0,
    }));
  }

  async findOne(id: string, empresaId: string) {
    const cliente = await this.db.queryOne<Cliente>(
      `SELECT * FROM clientes WHERE id = $1 AND "empresaId" = $2`,
      [id, empresaId],
    );
    if (!cliente) return null;

    const agg = await this.db.queryOne<{ count: string; total: string; ultima: Date | null }>(
      `SELECT COUNT(*) AS count, SUM("totalLiquido") AS total, MAX("criadoEm") AS ultima
       FROM vendas
       WHERE "clienteId" = $1 AND "empresaId" = $2 AND status = 'CONCLUIDA'`,
      [id, empresaId],
    );

    return {
      ...cliente,
      compras:       Number(agg?.count ?? 0),
      gasto_total:   agg?.total ? Number(agg.total) : 0,
      ultima_compra: agg?.ultima ?? null,
    };
  }

  async findHistory(id: string, empresaId: string) {
    const vendas = await this.db.query<{
      id: string; criadoEm: Date; totalLiquido: string; status: string; itens_count: string
    }>(
      `SELECT v.id, v."criadoEm", v."totalLiquido", v.status, COUNT(iv.id) AS itens_count
       FROM vendas v
       LEFT JOIN itens_venda iv ON iv."vendaId" = v.id
       WHERE v."clienteId" = $1 AND v."empresaId" = $2
       GROUP BY v.id
       ORDER BY v."criadoEm" DESC`,
      [id, empresaId],
    );

    return vendas.map(v => ({
      id:     v.id,
      data:   v.criadoEm,
      valor:  Number(v.totalLiquido),
      itens:  Number(v.itens_count),
      status: v.status,
    }));
  }

  async getRfm(empresaId: string, inicio?: string, fim?: string) {
    const hoje       = new Date()
    const dataInicio = inicio ? new Date(inicio) : new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate())
    const dataFim    = fim    ? new Date(fim + 'T23:59:59') : hoje

    const rows = await this.db.query<{
      clienteId:    string
      nome:         string
      ultima_compra: Date
      frequencia:   number
      monetario:    string
    }>(
      `SELECT v."clienteId", c.nome,
         MAX(v."criadoEm") AS ultima_compra,
         COUNT(DISTINCT v.id)::int AS frequencia,
         SUM(iv.quantidade * iv."precoUnitario") AS monetario
       FROM vendas v
       JOIN itens_venda iv ON iv."vendaId" = v.id
       JOIN clientes c ON c.id = v."clienteId"
       WHERE v."empresaId" = $1
         AND v.status = 'CONCLUIDA'
         AND v."criadoEm" BETWEEN $2 AND $3
         AND v."clienteId" IS NOT NULL
       GROUP BY v."clienteId", c.nome`,
      [empresaId, dataInicio, dataFim],
    )

    const meta = {
      periodo_solicitado_inicio: inicio ?? dataInicio.toISOString().slice(0, 10),
      periodo_solicitado_fim:    fim    ?? dataFim.toISOString().slice(0, 10),
      periodo_real_inicio:       null as string | null,
      periodo_real_fim:          null as string | null,
      total_clientes:            rows.length,
    }

    if (!rows.length) return { data: [], meta }

    const agora           = new Date()
    const diasPorCliente  = rows.map(r => Math.floor((agora.getTime() - new Date(r.ultima_compra).getTime()) / 86400000))
    const freqPorCliente  = rows.map(r => Number(r.frequencia))
    const monPorCliente   = rows.map(r => Number(r.monetario))

    const sortedR = [...diasPorCliente].sort((a, b) => a - b)
    const sortedF = [...freqPorCliente].sort((a, b) => a - b)
    const sortedM = [...monPorCliente].sort((a, b) => a - b)
    const n       = rows.length

    // higherIsBetter=true → maior valor = melhor rank (F, M)
    // higherIsBetter=false → menor valor = melhor rank (R = dias desde última compra)
    const score = (value: number, sorted: number[], higherIsBetter: boolean): number => {
      const posAsc = sorted.indexOf(value)
      const rank   = higherIsBetter ? posAsc + 1 : n - posAsc
      return Math.ceil((rank / n) * 5)
    }

    const data = rows.map((r, i) => {
      const dias    = diasPorCliente[i]
      const freq    = freqPorCliente[i]
      const mon     = monPorCliente[i]
      const score_r = score(dias, sortedR, false)
      const score_f = score(freq, sortedF, true)
      const score_m = score(mon,  sortedM, true)

      let segmento: string
      if      (score_r >= 4 && score_f >= 4 && score_m >= 4) segmento = 'Campeão'
      else if (score_f >= 4 && score_m >= 4)                  segmento = 'Leal'
      else if (score_r <= 2 && score_f >= 3)                  segmento = 'Em Risco'
      else if (freq === 1)                                     segmento = 'Novo'
      else if (score_r <= 2)                                   segmento = 'Dormente'
      else                                                     segmento = 'Regular'

      return { clienteId: r.clienteId, nome: r.nome, R: dias, F: freq, M: +mon.toFixed(2), score_r, score_f, score_m, segmento, ultima_compra: r.ultima_compra }
    })

    data.sort((a, b) => (b.score_r + b.score_f + b.score_m) - (a.score_r + a.score_f + a.score_m))

    const timestamps = rows.map(r => new Date(r.ultima_compra).getTime())
    meta.periodo_real_inicio = new Date(Math.min(...timestamps)).toISOString().slice(0, 10)
    meta.periodo_real_fim    = new Date(Math.max(...timestamps)).toISOString().slice(0, 10)

    return { data, meta }
  }

  async update(id: string, dto: UpdateClienteDto, empresaId: string) {
    const existe = await this.db.queryOne(
      `SELECT id FROM clientes WHERE id = $1 AND "empresaId" = $2`,
      [id, empresaId],
    );
    if (!existe) throw new NotFoundException('Cliente não encontrado');

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const campos: (keyof UpdateClienteDto)[] = [
      'nome', 'email', 'telefone', 'cpf_cnpj', 'nascimento', 'cidade', 'segmento', 'obs',
    ];
    for (const campo of campos) {
      if (dto[campo] !== undefined) {
        const val = campo === 'nascimento' && dto[campo] ? new Date(dto[campo] as string) : dto[campo];
        sets.push(`"${campo}" = $${idx++}`);
        params.push(val);
      }
    }

    if (!sets.length) return existe;

    params.push(id);
    return this.db.queryOne<Cliente>(
      `UPDATE clientes SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
  }
}
