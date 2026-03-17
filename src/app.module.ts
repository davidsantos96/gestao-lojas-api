import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { EstoqueModule } from './modules/estoque/estoque.module'
import { FinanceiroModule } from './modules/financeiro/financeiro.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EstoqueModule,
    FinanceiroModule,
  ],
})
export class AppModule {}
