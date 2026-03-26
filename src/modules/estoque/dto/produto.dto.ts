import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsString, IsNotEmpty, IsEnum, IsOptional,
  IsNumber, IsPositive, IsInt, Min,
} from 'class-validator'
import { CategoriaEstoque, CategoriaEstoqueEnum } from '../../../database/entities'

// ─── Criar produto ────────────────────────────────────────────────────────────
export class CreateProdutoDto {
  @ApiProperty({ example: 'CAM-001' })
  @IsString() @IsNotEmpty()
  sku: string

  @ApiProperty({ example: 'Camiseta Básica P' })
  @IsString() @IsNotEmpty()
  nome: string

  @ApiProperty({ enum: CategoriaEstoqueEnum })
  @IsEnum(CategoriaEstoqueEnum)
  categoria: CategoriaEstoque

  @ApiPropertyOptional({ example: 'Preto' })
  @IsOptional() @IsString()
  cor?: string

  @ApiProperty({ example: 49.90 })
  @IsNumber() @IsPositive()
  preco: number

  @ApiProperty({ example: 22.00 })
  @IsNumber() @IsPositive()
  custo: number

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsOptional() @IsInt() @Min(0)
  estoque_inicial?: number

  @ApiPropertyOptional({ example: 5, default: 0 })
  @IsOptional() @IsInt() @Min(0)
  minimo?: number
}

// ─── Atualizar produto (todos os campos opcionais) ────────────────────────────
export class UpdateProdutoDto extends PartialType(CreateProdutoDto) {}

// ─── Filtros de listagem ──────────────────────────────────────────────────────
export class QueryProdutosDto {
  @ApiPropertyOptional({ example: 'camiseta' })
  @IsOptional() @IsString()
  busca?: string

  @ApiPropertyOptional({ enum: CategoriaEstoqueEnum })
  @IsOptional() @IsEnum(CategoriaEstoqueEnum)
  categoria?: CategoriaEstoque

  @ApiPropertyOptional({ enum: ['ok', 'low', 'out'] })
  @IsOptional() @IsString()
  status?: 'ok' | 'low' | 'out'

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsInt() @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 100 })
  @IsOptional() @IsInt() @Min(1)
  limit?: number = 100
}
