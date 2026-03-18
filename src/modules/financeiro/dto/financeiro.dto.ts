import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsString, IsNotEmpty, IsEnum, IsOptional,
  IsNumber, IsPositive, IsInt, IsDateString, Min,
} from 'class-validator'
import { StatusConta, TipoLancamento } from '@prisma/client'

// ─── Conta a Pagar ────────────────────────────────────────────────────────────
export class CreateContaPagarDto {
  @ApiProperty({ example: 'Fornecedor Têxtil Alfa' })
  @IsString() @IsNotEmpty()
  descricao: string

  @ApiProperty({ example: 4800.00 })
  @IsNumber() @IsPositive()
  valor: number

  @ApiProperty({ example: '2026-03-20' })
  @IsDateString()
  vencimento: string

  @ApiPropertyOptional({ example: 'clxyz123' })
  @IsOptional() @IsString()
  categoria_id?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  obs?: string
}

export class UpdateContaPagarDto extends PartialType(CreateContaPagarDto) {}

export class QueryContasPagarDto {
  @ApiPropertyOptional({ enum: StatusConta })
  @IsOptional() @IsEnum(StatusConta)
  status?: StatusConta

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  categoria_id?: string

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional() @IsDateString()
  vencimento_de?: string

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional() @IsDateString()
  vencimento_ate?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsInt() @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 50 })
  @IsOptional() @IsInt() @Min(1)
  limit?: number = 50
}

// ─── Conta a Receber ──────────────────────────────────────────────────────────
export class CreateContaReceberDto {
  @ApiProperty({ example: 'Parcelamento Venda #4790' })
  @IsString() @IsNotEmpty()
  descricao: string

  @ApiPropertyOptional({ example: 'Maria Santos' })
  @IsOptional() @IsString()
  cliente?: string

  @ApiProperty({ example: 1200.00 })
  @IsNumber() @IsPositive()
  valor: number

  @ApiProperty({ example: '2026-03-18' })
  @IsDateString()
  vencimento: string

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  obs?: string
}

export class UpdateContaReceberDto extends PartialType(CreateContaReceberDto) {}

export class QueryContasReceberDto {
  @ApiPropertyOptional({ enum: StatusConta })
  @IsOptional() @IsEnum(StatusConta)
  status?: StatusConta

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  cliente?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsInt() @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 50 })
  @IsOptional() @IsInt() @Min(1)
  limit?: number = 50
}

// ─── Lançamento ───────────────────────────────────────────────────────────────
export class CreateLancamentoDto {
  @ApiProperty({ enum: TipoLancamento })
  @IsEnum(TipoLancamento)
  tipo: TipoLancamento

  @ApiProperty({ example: 'Vendas balcão — 1ª quinzena' })
  @IsString() @IsNotEmpty()
  descricao: string

  @ApiProperty({ example: 28000.00 })
  @IsNumber() @IsPositive()
  valor: number

  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  data: string

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  categoria_id?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  obs?: string
}

// ─── Filtros Lançamentos ─────────────────────────────────────────────────────
export class QueryLancamentosDto {
  @ApiPropertyOptional({ enum: TipoLancamento })
  @IsOptional() @IsEnum(TipoLancamento)
  tipo?: TipoLancamento

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional() @IsDateString()
  data_de?: string

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional() @IsDateString()
  data_ate?: string

  @ApiPropertyOptional({ example: 'clxyz123' })
  @IsOptional() @IsString()
  categoria_id?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsInt() @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 50 })
  @IsOptional() @IsInt() @Min(1)
  limit?: number = 50
}

// ─── Filtros Cashflow / DRE ───────────────────────────────────────────────────
export class QueryCashflowDto {
  @ApiPropertyOptional({ default: 7, description: 'Últimos N meses' })
  @IsOptional() @IsInt() @Min(1)
  meses?: number = 7
}

export class QueryDREDto {
  @ApiPropertyOptional({ example: '2026-03', description: 'Mês no formato YYYY-MM' })
  @IsOptional() @IsString()
  mes?: string
}
