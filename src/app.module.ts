import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { EstoqueModule } from './modules/estoque/estoque.module'
import { FinanceiroModule } from './modules/financeiro/financeiro.module'
import { AuthModule } from './modules/auth/auth.module'
import { VendasModule } from './modules/vendas/vendas.module'
import { ClientesModule } from './modules/clientes/clientes.module'
import { HealthModule } from './health/health.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.' + process.env.NODE_ENV, '.env'],
    }),
    PrismaModule,
    AuthModule,
    EstoqueModule,
    FinanceiroModule,
    VendasModule,
    ClientesModule,
    HealthModule,
  ],
  providers: [
    // Guard JWT aplicado globalmente em todas as rotas
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
