import { Controller, Post, Get, Body, Req } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { Public } from '../../common/decorators/public.decorator'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuário' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Get('me')
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  async me(@Req() req: any) {
    // JwtAuthGuard já verificou o token e populou req.user
    return this.authService.me(req.user.sub)
  }
}
