import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, IsNumber, NotEquals } from 'class-validator'
import { TipoMovimento } from '@prisma/client'

// ─── Registrar movimentação ───────────────────────────────────────────────────
export class CreateMovimentacaoDto {
  @ApiProperty({ example: 'clxyz123' })
  @IsString() @IsNotEmpty()
  produto_id: string

  @ApiProperty({ enum: TipoMovimento })
  @IsEnum(TipoMovimento)
  tipo: TipoMovimento

  @ApiProperty({ description: 'Positivo para ENTRADA, negativo para SAIDA/AJUSTE', example: 10 })
  @IsInt() @NotEquals(0, { message: 'Quantidade não pode ser zero.' })
  quantidade: number

  @ApiPropertyOptional({ example: 'Fornecedor A' })
  @IsOptional() @IsString()
  origem?: string

  @ApiPropertyOptional({ example: 'Reposição de verão' })
  @IsOptional() @IsString()
  obs?: string
}

// ─── Filtros de listagem ──────────────────────────────────────────────────────
export class QueryMovimentacoesDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  produto_id?: string

  @ApiPropertyOptional({ enum: TipoMovimento })
  @IsOptional() @IsEnum(TipoMovimento)
  tipo?: TipoMovimento

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional() @IsString()
  de?: string

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional() @IsString()
  ate?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsInt()
  page?: number = 1

  @ApiPropertyOptional({ default: 50 })
  @IsOptional() @IsInt()
  limit?: number = 50
}
