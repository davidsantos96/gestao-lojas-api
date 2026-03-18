import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { EstoqueModule } from './modules/estoque/estoque.module'
import { FinanceiroModule } from './modules/financeiro/financeiro.module'
import { AuthModule } from './modules/auth/auth.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EstoqueModule,
    FinanceiroModule,
    HealthModule,
  ],
})
export class AppModule {}
