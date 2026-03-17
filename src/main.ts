import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  })

  // ── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api')

  // ── Filtro global de erros ────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter())

  // ── Validation pipe ───────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // ── Swagger ───────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Sistema de Controle de Lojas — API')
    .setDescription('Endpoints dos módulos Estoque e Financeiro')
    .setVersion('1.0')
    .addTag('estoque')
    .addTag('financeiro')
    .build()

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config))

  const port = process.env.PORT || 3000
  await app.listen(port)
  console.log(`🚀 API rodando em http://localhost:${port}/api`)
  console.log(`📖 Swagger em   http://localhost:${port}/docs`)
}

bootstrap()
