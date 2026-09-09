import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';

import { Permissions } from './decorators/permissions.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PermissionsGuard } from './guards/permissions.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    roles: string[];
    permissions: string[];
    mustChangePassword: boolean;
    employeeProfile: {
      employeeId: string;
      fullName: string;
      profileImageUrl: string | null;
      designation: string | null;
    } | null;
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private getAllowedOrigins(): Set<string> {
    const configured =
      this.configService.get<string>('FRONTEND_ORIGINS') ??
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:3000';

    return new Set(
      configured
        .split(',')
        .map((value) => value.trim().replace(/\/$/, ''))
        .filter(Boolean),
    );
  }

  private assertTrustedBrowserOrigin(request: Request) {
    const origin = request.headers.origin;

    // Non-browser clients may omit Origin. Browser cookie requests do not.
    if (!origin) return;

    if (!this.getAllowedOrigins().has(origin.replace(/\/$/, ''))) {
      throw new ForbiddenException('Untrusted request origin.');
    }
  }

  private refreshExpiresDays() {
    const configured = Number(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_DAYS') ?? '30',
    );

    if (!Number.isFinite(configured) || configured < 1 || configured > 90) {
      return 30;
    }

    return Math.floor(configured);
  }

  private refreshCookieOptions(): CookieOptions {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: this.refreshExpiresDays() * 24 * 60 * 60 * 1000,
    };
  }

  private getLoginMetadata(request: Request) {
    const userAgent = request.headers['user-agent'] ?? '';
    const ipAddress = request.ip;

    let browser = 'Unknown';

    if (
      userAgent.includes('PowerShell') ||
      userAgent.includes('WindowsPowerShell')
    ) {
      browser = 'PowerShell';
    } else if (userAgent.includes('Edg/')) {
      browser = 'Microsoft Edge';
    } else if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) {
      browser = 'Opera';
    } else if (userAgent.includes('Chrome/')) {
      browser = 'Google Chrome';
    } else if (userAgent.includes('Firefox/')) {
      browser = 'Mozilla Firefox';
    } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
      browser = 'Safari';
    }

    let os = 'Unknown';

    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    else if (userAgent.includes('Mac OS')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';

    let deviceName = 'Desktop';

    if (userAgent.includes('iPhone')) deviceName = 'iPhone';
    else if (userAgent.includes('iPad')) deviceName = 'iPad';
    else if (userAgent.includes('Android')) deviceName = 'Android Device';
    else if (userAgent.includes('Windows')) deviceName = 'Windows PC';
    else if (userAgent.includes('Macintosh')) deviceName = 'Mac';

    return {
      ipAddress,
      userAgent: userAgent.slice(0, 1000),
      deviceName,
      browser,
      os,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedBrowserOrigin(request);

    const result = await this.authService.login(
      loginDto,
      this.getLoginMetadata(request),
    );

    response.cookie('refresh_token', result.refreshToken, this.refreshCookieOptions());

    return {
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.changePassword(
      request.user.id,
      dto,
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.forgotPassword(
      forgotPasswordDto,
      this.getLoginMetadata(request),
    );
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedBrowserOrigin(request);

    const refreshToken = request.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token cookie is missing.');
    }

    const result = await this.authService.refresh(
      refreshToken,
      this.getLoginMetadata(request),
    );

    response.cookie('refresh_token', result.refreshToken, this.refreshCookieOptions());

    return {
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedBrowserOrigin(request);

    await this.authService.logout(request.cookies?.refresh_token);
    response.clearCookie('refresh_token', this.refreshCookieOptions());

    return {
      success: true,
      message: 'Logged out successfully.',
    };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedBrowserOrigin(request);

    const result = await this.authService.logoutAll(request.user.id);
    response.clearCookie('refresh_token', this.refreshCookieOptions());

    return {
      success: true,
      message: 'Logged out from all devices successfully.',
      revokedSessions: result.revokedSessions,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMe(@Req() request: AuthenticatedRequest) {
    return {
      success: true,
      user: request.user,
    };
  }

  @Get('permission-test')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @Permissions('tasks.critical.create')
  permissionTest(@Req() request: AuthenticatedRequest) {
    return {
      success: true,
      message: 'Critical Task permission verified.',
      user: {
        id: request.user.id,
        roles: request.user.roles,
        permissions: request.user.permissions,
      },
    };
  }
}
