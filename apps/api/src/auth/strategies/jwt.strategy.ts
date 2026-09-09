import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
} from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  type: 'access';
  familyId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
  'jwt',
) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const accessSecret =
      configService.get<string>(
        'JWT_ACCESS_SECRET',
      );

    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not configured.');
    }

    const isProduction =
      configService.get<string>('NODE_ENV') === 'production';

    if (isProduction && accessSecret.length < 32) {
      throw new Error(
        'JWT_ACCESS_SECRET must be at least 32 characters in production.',
      );
    }

    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access' || !payload.familyId) {
      throw new UnauthorizedException('Invalid access token.');
    }

    const activeSession = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        familyId: payload.familyId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!activeSession) {
      throw new UnauthorizedException('Session is no longer active.');
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          id: payload.sub,
        },
        include: {
          employeeProfile: {
            select: {
              employeeId: true,
              fullName: true,
              profileImageUrl: true,
              designation: true,
            },
          },

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

    const roles = user.roles
      .filter(
        (userRole) =>
          userRole.role.isActive,
      )
      .map(
        (userRole) =>
          userRole.role.name,
      );

    const permissions = [
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

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      roles,
      permissions,
      mustChangePassword:
        user.mustChangePassword,
      employeeProfile:
        user.employeeProfile,
    };
  }
}