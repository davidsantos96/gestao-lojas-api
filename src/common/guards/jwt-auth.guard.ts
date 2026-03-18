import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import * as jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'gestao-lojas-dev-secret-2026'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Rotas marcadas com @Public() passam sem token
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers['authorization']

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não informado')
    }

    const token = authHeader.replace('Bearer ', '')

    try {
      const payload = jwt.verify(token, JWT_SECRET) as Record<string, any>
      // Popula request.user com os dados do JWT (sub, empresaId, perfil, etc.)
      request.user = payload
      return true
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado')
    }
  }
}
