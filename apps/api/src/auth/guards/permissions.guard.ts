import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';

interface AuthenticatedUser {
  id: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(
        PERMISSIONS_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (
      !requiredPermissions ||
      requiredPermissions.length === 0
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{
        user?: AuthenticatedUser;
      }>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'User information is unavailable.',
      );
    }

    const hasAllPermissions =
      requiredPermissions.every((permission) =>
        user.permissions.includes(permission),
      );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }

    return true;
  }
}