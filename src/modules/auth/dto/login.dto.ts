import { IsEmail, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'admin@loja.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(4)
  senha: string
}
