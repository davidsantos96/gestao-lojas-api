import { Controller, Post, Get, Body, Headers, UnauthorizedException } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuário' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Get('me')
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  async me(@Headers('authorization') authHeader: string) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não informado')
    }

    const token = authHeader.replace('Bearer ', '')
    const decoded = this.authService.verifyToken(token) as any
    return this.authService.me(decoded.sub)
  }
}
