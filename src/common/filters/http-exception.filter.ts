import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx      = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request  = ctx.getRequest<Request>()

    let status  = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Erro interno do servidor'

    if (exception instanceof HttpException) {
      status  = exception.getStatus()
      const res = exception.getResponse()
      message = typeof res === 'string' ? res : (res as any).message ?? message

    } else if ((exception as any)?.code === '23505') {
      // pg: unique_violation
      status  = HttpStatus.CONFLICT
      message = 'Já existe um registro com esses dados.'

    } else if ((exception as any)?.code === '23503') {
      // pg: foreign_key_violation
      status  = HttpStatus.BAD_REQUEST
      message = 'Referência inválida: registro relacionado não encontrado.'

    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack)
    }

    response.status(status).json({
      statusCode: status,
      message,
      path:      request.url,
      timestamp: new Date().toISOString(),
    })
  }
}
