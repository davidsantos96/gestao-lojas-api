import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common'

/**
 * Extrai o empresaId do usuário autenticado (JWT).
 * O JwtAuthGuard popula request.user antes desta execução.
 *
 * Uso: @EmpresaId() empresaId: string
 */
export const EmpresaId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    const empresaId = request.user?.empresaId
    if (!empresaId) throw new UnauthorizedException('Empresa não identificada no token')
    return empresaId
  },
)
