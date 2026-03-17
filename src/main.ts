import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // ── CORS ──────────────────────────────────────────────────────────────────
  const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim())

  app.enableCors({
    origin:      origins,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  })

  // ── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api')

  // ── Filtro global de erros ────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter())

  // ── Validation pipe ───────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:             true,
      forbidNonWhitelisted:  true,
      transform:             true,
      transformOptions:      { enableImplicitConversion: true },
    }),
  )

  // ── Swagger ───────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Sistema de Controle de Lojas — API')
    .setDescription('Endpoints dos módulos Estoque e Financeiro')
    .setVersion('1.0')
    .addTag('estoque')
    .addTag('financeiro')
    .addTag('health')
    .build()

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config))

  // ── Listen — Railway injeta PORT dinamicamente ────────────────────────────
  const port = process.env.PORT || 3000
  await app.listen(port, '0.0.0.0')

  console.log(`🚀 API rodando em http://0.0.0.0:${port}/api`)
  console.log(`📖 Swagger em   http://0.0.0.0:${port}/docs`)
}

bootstrap()
