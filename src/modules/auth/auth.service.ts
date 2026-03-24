import { Injectable, UnauthorizedException, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { Usuario } from '../../database/entities'
import { LoginDto } from './dto/login.dto'
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'gestao-lojas-dev-secret-2026'
const JWT_EXPIRES = '24h'

type UsuarioComEmpresa = Usuario & { empresa_nome: string }

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly blacklist = new Set<string>()

  constructor(private db: DatabaseService) {}

  /** Invalida um token JWT (logout) */
  logout(token: string): void {
    this.blacklist.add(token)
  }

  /** Verifica se o token foi revogado */
  isBlacklisted(token: string): boolean {
    return this.blacklist.has(token)
  }

  async login(dto: LoginDto) {
    try {
      const row = await this.db.queryOne<UsuarioComEmpresa>(
        `SELECT u.*, e.nome AS empresa_nome
         FROM usuarios u
         JOIN empresas e ON e.id = u."empresaId"
         WHERE u.email = $1 AND u.ativo = true
         LIMIT 1`,
        [dto.email],
      )

      if (!row || !row.senha) {
        throw new UnauthorizedException('Email ou senha inválidos')
      }

      let senhaValida = false
      try {
        senhaValida = await bcrypt.compare(dto.senha, row.senha)
      } catch {
        this.logger.warn(`Hash de senha inválido para usuário: ${row.email}`)
      }
      if (!senhaValida) {
        throw new UnauthorizedException('Email ou senha inválidos')
      }

      const payload = {
        sub: row.id,
        email: row.email,
        nome: row.nome,
        perfil: row.perfil,
        empresaId: row.empresaId,
        empresaNome: row.empresa_nome,
      }

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })

      return {
        token,
        usuario: {
          id: row.id,
          nome: row.nome,
          email: row.email,
          perfil: row.perfil,
          empresaId: row.empresaId,
          empresaNome: row.empresa_nome,
        },
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err
      this.logger.error('Erro inesperado no login', err?.stack ?? err)
      throw err
    }
  }

  /** Verifica e decodifica um token JWT */
  verifyToken(token: string) {
    try {
      return jwt.verify(token, JWT_SECRET)
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado')
    }
  }

  /** Busca dados do usuário pelo ID (para /me) */
  async me(userId: string) {
    const row = await this.db.queryOne<UsuarioComEmpresa>(
      `SELECT u.*, e.nome AS empresa_nome
       FROM usuarios u
       JOIN empresas e ON e.id = u."empresaId"
       WHERE u.id = $1`,
      [userId],
    )

    if (!row || !row.ativo) {
      throw new UnauthorizedException('Usuário não encontrado')
    }

    return {
      id: row.id,
      nome: row.nome,
      email: row.email,
      perfil: row.perfil,
      empresaId: row.empresaId,
      empresaNome: row.empresa_nome,
    }
  }
}
