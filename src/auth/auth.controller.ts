import { Controller, Post, Body, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { LoginInput, LoginSchema, RegisterInput, RegisterSchema } from 'src/common/schemas/validation.schemas';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with Zod validation' })
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(@Body() loginDto: LoginInput) {
    return await this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register with Zod validation' })
  @UsePipes(new ZodValidationPipe(RegisterSchema))
  async register(@Body() registerDto: RegisterInput) {
    return await this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.name,
    );
  }
}