import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * Extrai o empresaId da request.
 * Por ora usa um header fixo X-Empresa-Id.
 * Quando autenticação JWT for implementada, virá do token.
 *
 * Uso: @EmpresaId() empresaId: string
 */
export const EmpresaId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    // Futuro: return request.user.empresaId
    return request.headers['x-empresa-id'] || 'empresa-demo'
  },
)
