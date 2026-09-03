import { Body, Controller, Post, Get, Param, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: thirtyDays,
      path: '/',
    });

    // Keep the refresh cookie/API available for existing API clients.
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: thirtyDays,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email/password. Sets httpOnly cookies for auth.' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result.access_token, result.refresh_token);
    return result;
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh_token from cookie or body.' })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'] || dto.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    const result = await this.authService.refreshToken(refreshToken);
    this.setAuthCookies(res, result.access_token, result.refresh_token);
    return result;
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.sendResetPasswordEmail(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.token, dto.newPassword);
  }

  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: RequestWithUser) {
    return this.authService.getMyProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logout(req.user.id);
    this.clearAuthCookies(res);
    return result;
  }
}
