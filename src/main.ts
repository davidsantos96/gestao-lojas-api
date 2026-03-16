import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

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

  // ── Validation pipe ───────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // remove campos não declarados no DTO
      forbidNonWhitelisted: true,
      transform: true,          // converte tipos automaticamente (string → number)
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

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document)

  const port = process.env.PORT || 3000
  await app.listen(port)
  console.log(`🚀 API rodando em http://localhost:${port}/api`)
  console.log(`📖 Swagger em   http://localhost:${port}/docs`)
}

bootstrap()
