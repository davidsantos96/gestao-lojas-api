import { Injectable, UnauthorizedException, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'gestao-lojas-dev-secret-2026'
const JWT_EXPIRES = '24h'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly blacklist = new Set<string>()

  constructor(private prisma: PrismaService) {}

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
      // Busca usuário pelo email (em qualquer empresa)
      const usuario = await this.prisma.usuario.findFirst({
        where: { email: dto.email, ativo: true },
        include: { empresa: { select: { id: true, nome: true } } },
      })

      if (!usuario || !usuario.senha) {
        throw new UnauthorizedException('Email ou senha inválidos')
      }

      // Compara hash da senha
      const senhaValida = await bcrypt.compare(dto.senha, usuario.senha)
      if (!senhaValida) {
        throw new UnauthorizedException('Email ou senha inválidos')
      }

      // Gera JWT
      const payload = {
        sub: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        perfil: usuario.perfil,
        empresaId: usuario.empresaId,
        empresaNome: usuario.empresa.nome,
      }

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })

      return {
        token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil,
          empresaId: usuario.empresaId,
          empresaNome: usuario.empresa.nome,
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
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: { empresa: { select: { id: true, nome: true } } },
    })

    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Usuário não encontrado')
    }

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      empresaId: usuario.empresaId,
      empresaNome: usuario.empresa.nome,
    }
  }
}
