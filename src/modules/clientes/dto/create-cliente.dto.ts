import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateClienteDto {
  @ApiProperty({ description: 'Nome do cliente' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiPropertyOptional({ description: 'E-mail de contato' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Telefone com DDD' })
  @IsOptional()
  @IsString()
  telefone?: string;

  @ApiPropertyOptional({ description: 'CPF ou CNPJ (apenas números)' })
  @IsOptional()
  @IsString()
  cpf_cnpj?: string;

  @ApiPropertyOptional({ description: 'Data de nascimento (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  nascimento?: string;

  @ApiPropertyOptional({ description: 'Cidade do cliente' })
  @IsOptional()
  @IsString()
  cidade?: string;

  @ApiPropertyOptional({ description: 'Segmento inicial sugerido' })
  @IsOptional()
  @IsString()
  segmento?: string;

  @ApiPropertyOptional({ description: 'Observações internas iniciais' })
  @IsOptional()
  @IsString()
  obs?: string;
}
