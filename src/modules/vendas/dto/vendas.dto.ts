import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'

export enum FormaPagamentoDto {
  DINHEIRO       = 'DINHEIRO',
  PIX            = 'PIX',
  CARTAO_CREDITO = 'CARTAO_CREDITO',
  CARTAO_DEBITO  = 'CARTAO_DEBITO',
  BOLETO         = 'BOLETO',
  OUTRO          = 'OUTRO',
}

export class ItemVendaDto {
  @IsString()
  produto_id: string

  @IsInt() @Min(1)
  quantidade: number

  @IsNumber()
  preco_unitario: number

  @IsNumber() @IsOptional()
  desconto?: number
}

export class CreateVendaDto {
  @IsOptional() @IsString()
  cliente?: string

  @IsOptional() @IsString()
  cliente_id?: string

  // Alias camelCase enviado pelo frontend
  @IsOptional() @IsString()
  clienteId?: string

  @IsEnum(FormaPagamentoDto)
  forma_pagamento: FormaPagamentoDto

  @IsInt() @Min(1) @IsOptional()
  parcelas?: number

  @IsNumber() @IsOptional()
  desconto?: number

  @IsOptional() @IsString()
  obs?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemVendaDto)
  itens: ItemVendaDto[]
}

export class QueryVendasDto {
  @IsOptional() data_de?: string
  @IsOptional() data_ate?: string
  @IsOptional() status?: string
  @IsOptional() cliente?: string
  @IsOptional() cliente_id?: string
  @IsOptional() forma_pagamento?: string
  @IsOptional() page?: number
  @IsOptional() limit?: number
}
