import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'

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

    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Violação de unique constraint
      if (exception.code === 'P2002') {
        status  = HttpStatus.CONFLICT
        const fields = (exception.meta?.target as string[])?.join(', ')
        message = `Já existe um registro com ${fields || 'esses dados'}.`
      }
      // Registro não encontrado em relação
      else if (exception.code === 'P2025') {
        status  = HttpStatus.NOT_FOUND
        message = 'Registro não encontrado.'
      }

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
