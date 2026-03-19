import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsInt } from 'class-validator';

export class QueryVendasDto {
  @ApiPropertyOptional({ example: 'clxyz123' })
  @IsOptional() @IsString()
  produto_id?: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional() @IsDateString()
  data_inicio?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional() @IsDateString()
  data_fim?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional() @IsInt()
  limit?: number = 50;
}
