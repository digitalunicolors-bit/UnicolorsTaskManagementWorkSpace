import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { randomBytes } from 'crypto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';


interface LoginMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
  browser?: string;
  os?: string;
}
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }

  private parseDurationToSeconds(
    value: string,
    fallbackSeconds: number,
  ): number {
    const match = value
      .trim()
      .match(/^(\d+)(s|m|h|d)$/i);

    if (!match) {
      return fallbackSeconds;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 's':
        return amount;

      case 'm':
        return amount * 60;

      case 'h':
        return amount * 60 * 60;

      case 'd':
        return amount * 24 * 60 * 60;

      default:
        return fallbackSeconds;
    }
  }

  private getRefreshExpiresDays(): number {
    const configured = Number(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_DAYS') ?? '30',
    );

    if (!Number.isFinite(configured) || configured < 1 || configured > 90) {
      return 30;
    }

    return Math.floor(configured);
  }

  private assertJwtSecret(name: string, value: string | undefined): string {
    if (!value) {
      throw new InternalServerErrorException('JWT configuration is missing');
    }

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (isProduction && value.length < 32) {
      throw new InternalServerErrorException(
        `${name} must be at least 32 characters in production.`,
      );
    }

    return value;
  }

  async validateCredentials(
  loginDto: LoginDto,
  metadata: LoginMetadata = {},
)  {
    const identifier = loginDto.identifier.trim();

    if (!identifier) {
      throw new UnauthorizedException('Invalid phone/email/username or password');
    }

    if (metadata.ipAddress) {
      const recentFailedAttempts = await this.prisma.loginHistory.count({
        where: {
          eventType: 'LOGIN_FAILED',
          ipAddress: metadata.ipAddress,
          createdAt: {
            gte: new Date(Date.now() - 15 * 60 * 1000),
          },
        },
      });

      if (recentFailedAttempts >= 30) {
        throw new UnauthorizedException(
          'Too many login attempts. Please try again later.',
        );
      }
    }

    const normalizedUsername =
      identifier
        .replace(/^@+/, '')
        .toLowerCase();

    const usernameOwner =
      await this.prisma.employeeProfile.findFirst({
        where: {
          username: normalizedUsername,
          deletedAt: null,
        },
        select: {
          userId: true,
        },
      });

    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          {
            email: identifier.toLowerCase(),
          },
          {
            phone: identifier,
          },
          ...(usernameOwner
            ? [
                {
                  id: usernameOwner.userId,
                },
              ]
            : []),
        ],
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      await this.prisma.loginHistory.create({
        data: {
          userId: null,
          eventType: 'LOGIN_FAILED',
          identifier,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          deviceName: metadata.deviceName,
          browser: metadata.browser,
          os: metadata.os,
          failureReason: 'INVALID_IDENTIFIER_OR_PASSWORD',
        },
      });

      throw new UnauthorizedException('Invalid phone/email/username or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account is inactive',
      );
    }

    if (
      user.lockedUntil &&
      user.lockedUntil.getTime() > Date.now()
    ) {
      throw new UnauthorizedException(
        'Account temporarily locked. Please try again later.',
      );
    }

    const passwordMatches = await compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      const failedAttempts =
        user.failedLoginAttempts + 1;

      const shouldLock =
        failedAttempts >= MAX_FAILED_ATTEMPTS;

      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil: shouldLock
            ? new Date(
                Date.now() +
                  LOCKOUT_MINUTES * 60 * 1000,
              )
            : null,
        },
      });

      await this.prisma.loginHistory.create({
        data: {
          userId: user.id,
          eventType: 'LOGIN_FAILED',
          identifier,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          deviceName: metadata.deviceName,
          browser: metadata.browser,
          os: metadata.os,
          failureReason: shouldLock
            ? 'ACCOUNT_LOCKED_AFTER_REPEATED_FAILURES'
            : 'INVALID_PASSWORD',
        },
      });
      throw new UnauthorizedException(
        shouldLock
          ? 'Too many failed attempts. Account temporarily locked.'
          : 'Invalid phone/email/username or password',
      );
    }

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
    await this.prisma.loginHistory.create({
      data: {
        userId: user.id,
        eventType: 'LOGIN_SUCCESS',
        identifier,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        deviceName: metadata.deviceName,
        browser: metadata.browser,
        os: metadata.os,
      },
    });

    const { passwordHash, ...safeUser } = user;

    return safeUser;
  }

  async login(
  loginDto: LoginDto,
  metadata: LoginMetadata = {},
) {
  const user = await this.validateCredentials(
    loginDto,
    metadata,
  );

    const accessSecret = this.assertJwtSecret(
      'JWT_ACCESS_SECRET',
      this.configService.get<string>('JWT_ACCESS_SECRET'),
    );

    const refreshSecret = this.assertJwtSecret(
      'JWT_REFRESH_SECRET',
      this.configService.get<string>('JWT_REFRESH_SECRET'),
    );

    const activeRoles = user.roles.filter(
      (userRole) => userRole.role.isActive,
    );

    const roleNames = activeRoles.map(
      (userRole) => userRole.role.name,
    );

    const permissionCodes = [
      ...new Set(
        activeRoles.flatMap((userRole) =>
          userRole.role.permissions.map(
            (rolePermission) => rolePermission.permission.code,
          ),
        ),
      ),
    ];

    const accessExpiresValue =
      this.configService.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
      ) ?? '15m';

    const accessExpiresSeconds =
      this.parseDurationToSeconds(
        accessExpiresValue,
        15 * 60,
      );

    const refreshExpiresDays = this.getRefreshExpiresDays();

    const familyId = randomUUID();

    const accessToken =
      await this.jwtService.signAsync(
        {
          sub: user.id,
          type: 'access',
          familyId,
          roles: roleNames,
          permissions: permissionCodes,
        },
        {
          secret: accessSecret,
          expiresIn: accessExpiresSeconds,
        },
      );

    const refreshToken =
      await this.jwtService.signAsync(
        {
          sub: user.id,
          type: 'refresh',
          familyId,
          jti: randomUUID(),
        },
        {
          secret: refreshSecret,
          expiresIn:
            refreshExpiresDays *
            24 *
            60 *
            60,
        },
      );

    const refreshTokenHash =
      this.hashToken(refreshToken);

    const refreshExpiresAt = new Date(
      Date.now() +
        refreshExpiresDays *
          24 *
          60 *
          60 *
          1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        familyId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        deviceName: metadata.deviceName,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        roles: roleNames,
        permissions: permissionCodes,
        mustChangePassword:
          user.mustChangePassword,
      },

      accessToken,
      refreshToken,
    };
  }

  
  async refresh(
    refreshToken: string,
    metadata: LoginMetadata = {},
  ) {
  const refreshSecret = this.assertJwtSecret(
    'JWT_REFRESH_SECRET',
    this.configService.get<string>('JWT_REFRESH_SECRET'),
  );

  const accessSecret = this.assertJwtSecret(
    'JWT_ACCESS_SECRET',
    this.configService.get<string>('JWT_ACCESS_SECRET'),
  );

  let payload: {
    sub: string;
    type: string;
    familyId: string;
  };

  try {
    payload =
      await this.jwtService.verifyAsync<{
        sub: string;
        type: string;
        familyId: string;
      }>(refreshToken, {
        secret: refreshSecret,
      });
  } catch {
    throw new UnauthorizedException(
      'Invalid or expired refresh token.',
    );
  }

  if (
    payload.type !== 'refresh' ||
    !payload.sub ||
    !payload.familyId
  ) {
    throw new UnauthorizedException(
      'Invalid refresh token.',
    );
  }

  const tokenHash =
    this.hashToken(refreshToken);

  const storedToken =
    await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash,
      },
    });

  const tokenIsInvalid =
    !storedToken ||
    storedToken.revokedAt !== null ||
    storedToken.expiresAt.getTime() <=
      Date.now() ||
    storedToken.userId !== payload.sub ||
    storedToken.familyId !== payload.familyId;

  if (tokenIsInvalid) {
    await this.prisma.refreshToken.updateMany({
      where: {
        familyId: payload.familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    throw new UnauthorizedException(
      'Refresh token is no longer valid.',
    );
  }

  const user =
    await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

  if (
    !user ||
    !user.isActive ||
    user.deletedAt ||
    (user.lockedUntil && user.lockedUntil.getTime() > Date.now())
  ) {
    throw new UnauthorizedException(
      'User account is unavailable.',
    );
  }

  const roleNames = user.roles
    .filter(
      (userRole) =>
        userRole.role.isActive,
    )
    .map(
      (userRole) =>
        userRole.role.name,
    );

  const permissionCodes = [
    ...new Set(
      user.roles
        .filter(
          (userRole) =>
            userRole.role.isActive,
        )
        .flatMap((userRole) =>
          userRole.role.permissions.map(
            (rolePermission) =>
              rolePermission.permission.code,
          ),
        ),
    ),
  ];

  const accessExpiresValue =
    this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
    ) ?? '15m';

  const accessExpiresSeconds =
    this.parseDurationToSeconds(
      accessExpiresValue,
      15 * 60,
    );

  const refreshExpiresDays = this.getRefreshExpiresDays();

  const newAccessToken =
    await this.jwtService.signAsync(
      {
        sub: user.id,
        type: 'access',
        familyId: payload.familyId,
        roles: roleNames,
        permissions: permissionCodes,
      },
      {
        secret: accessSecret,
        expiresIn: accessExpiresSeconds,
      },
    );

  const newRefreshToken =
    await this.jwtService.signAsync(
      {
        sub: user.id,
        type: 'refresh',
        familyId: payload.familyId,
        jti: randomUUID(),
      },
      {
        secret: refreshSecret,
        expiresIn:
          refreshExpiresDays *
          24 *
          60 *
          60,
      },
    );

  const newRefreshTokenHash =
    this.hashToken(newRefreshToken);

  const refreshExpiresAt = new Date(
    Date.now() +
      refreshExpiresDays *
        24 *
        60 *
        60 *
        1000,
  );

  let rotationConflict = false;

  try {
    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      if (revoked.count !== 1) {
        rotationConflict = true;
        throw new Error('REFRESH_TOKEN_REUSE');
      }

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newRefreshTokenHash,
          familyId: payload.familyId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          deviceName: metadata.deviceName,
          expiresAt: refreshExpiresAt,
        },
      });
    });
  } catch (error) {
    if (rotationConflict) {
      await this.prisma.refreshToken.updateMany({
        where: {
          familyId: payload.familyId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      throw new UnauthorizedException(
        'Refresh token reuse detected. Please sign in again.',
      );
    }

    throw error;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      roles: roleNames,
      permissions: permissionCodes,
      mustChangePassword:
        user.mustChangePassword,
    },
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}
async logout(refreshToken: string | undefined) {
  if (!refreshToken) {
    return {
      success: true,
    };
  }

  const tokenHash = this.hashToken(refreshToken);

  const storedToken =
    await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash,
      },
    });

  if (
    storedToken &&
    storedToken.revokedAt === null
  ) {
    await this.prisma.refreshToken.updateMany({
      where: {
        familyId: storedToken.familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.prisma.loginHistory.create({
      data: {
        userId: storedToken.userId,
        eventType: 'LOGOUT',
      },
    });
  }

  return {
    success: true,
  };
}
async logoutAll(userId: string) {
  const now = new Date();

  const result =
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

  await this.prisma.loginHistory.create({
    data: {
      userId,
      eventType: 'SESSION_REVOKED',
    },
  });

  return {
    success: true,
    revokedSessions: result.count,
  };
}

async changePassword(
  userId: string,
  dto: ChangePasswordDto,
) {
  const user =
    await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        passwordHash: true,
        mustChangePassword: true,
      },
    });

  if (!user) {
    throw new UnauthorizedException(
      'User account is unavailable.',
    );
  }

  const matches = await compare(
    dto.currentPassword,
    user.passwordHash,
  );

  if (!matches) {
    throw new UnauthorizedException(
      'Current password is incorrect.',
    );
  }

  if (
    dto.currentPassword ===
    dto.newPassword
  ) {
    throw new BadRequestException(
      'New password must be different from the temporary password.',
    );
  }

  const passwordHash = await hash(
    dto.newPassword,
    12,
  );

  const now = new Date();

  await this.prisma.$transaction([
    this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),

    this.prisma.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    }),

    this.prisma.activityLog.create({
      data: {
        userId: user.id,
        action: user.mustChangePassword
          ? 'FIRST_LOGIN_PASSWORD_CHANGED'
          : 'PASSWORD_CHANGED',
        entityType: 'AUTH',
        entityId: user.id,
        metadata: {
          source: user.mustChangePassword
            ? 'MANDATORY_FIRST_LOGIN'
            : 'CHANGE_PASSWORD',
          sensitive: true,
        },
      },
    }),
  ]);

  return {
    success: true,
    message:
      'Password changed successfully. Please login with your new password.',
  };
}

async forgotPassword(
  forgotPasswordDto: ForgotPasswordDto,
  metadata: LoginMetadata = {},
) {
  const identifier =
    forgotPasswordDto.identifier.trim();

  const user =
    await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          {
            email:
              identifier.toLowerCase(),
          },
          {
            phone: identifier,
          },
        ],
      },
      select: {
        id: true,
      },
    });

  const genericResponse = {
    success: true,
    message:
      'If an active account matches those details, password reset instructions have been generated.',
  };

  if (!user) {
    return genericResponse;
  }

  const resetToken =
    randomBytes(32).toString('hex');

  const tokenHash =
    this.hashToken(resetToken);

  const expiresAt = new Date(
    Date.now() + 15 * 60 * 1000,
  );

  await this.prisma.$transaction([
    this.prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    }),

    this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        requestedIpAddress:
          metadata.ipAddress,
        requestedUserAgent:
          metadata.userAgent,
      },
    }),
  ]);

  const isProduction =
    this.configService.get<string>(
      'NODE_ENV',
    ) === 'production';

  if (!isProduction) {
    return {
      ...genericResponse,

      // Development testing only.
      devResetToken: resetToken,
      expiresAt,
    };
  }

  return genericResponse;
}
async resetPassword(
  resetPasswordDto: ResetPasswordDto,
) {
  const token =
    resetPasswordDto.token.trim();

  const tokenHash =
    this.hashToken(token);

  const resetRecord =
    await this.prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });

  if (!resetRecord) {
    throw new UnauthorizedException(
      'Invalid or expired password reset token.',
    );
  }

  if (resetRecord.usedAt) {
    throw new UnauthorizedException(
      'Password reset token has already been used.',
    );
  }

  if (
    resetRecord.expiresAt.getTime() <= Date.now()
  ) {
    throw new UnauthorizedException(
      'Password reset token has expired.',
    );
  }

  if (
    !resetRecord.user.isActive ||
    resetRecord.user.deletedAt
  ) {
    throw new UnauthorizedException(
      'User account is unavailable.',
    );
  }

  const newPasswordHash = await hash(
    resetPasswordDto.newPassword,
    12,
  );

  const now = new Date();

  await this.prisma.$transaction([
    this.prisma.user.update({
      where: {
        id: resetRecord.userId,
      },
      data: {
        passwordHash: newPasswordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        mustChangePassword: false,
      },
    }),

    this.prisma.passwordResetToken.update({
      where: {
        id: resetRecord.id,
      },
      data: {
        usedAt: now,
      },
    }),

    this.prisma.passwordResetToken.deleteMany({
      where: {
        userId: resetRecord.userId,
        id: {
          not: resetRecord.id,
        },
        usedAt: null,
      },
    }),

    this.prisma.refreshToken.updateMany({
      where: {
        userId: resetRecord.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    }),

    this.prisma.activityLog.create({
      data: {
        userId: resetRecord.userId,
        action: 'PASSWORD_RESET',
        entityType: 'AUTH',
        entityId: resetRecord.userId,
        metadata: {
          source: 'FORGOT_PASSWORD',
          sensitive: true,
        },
      },
    }),
  ]);

  return {
    success: true,
    message:
      'Password reset successfully. Please login with your new password.',
  };
}
}