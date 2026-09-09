import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import type { Request } from 'express';

import { DashboardService } from './dashboard.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    id?: string;
    userId?: string;
  };
};

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  private getUserId(
    request: AuthenticatedRequest,
  ) {
    const userId =
      request.user?.sub ??
      request.user?.id ??
      request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user id not found.',
      );
    }

    return userId;
  }

  // SUPER ADMIN ONLY
  @Get('super-admin')
  @Permissions('roles.manage')
  async superAdminDashboard() {
    const data =
      await this.dashboardService.adminDashboard();

    return {
      ...data,
      role: 'SUPER_ADMIN',
    };
  }

  // ADMIN + SUPER ADMIN
  @Get('admin')
  @Permissions('employees.manage')
  adminDashboard() {
    return this.dashboardService.adminDashboard();
  }

  // MANAGER + higher permitted roles
  @Get('manager')
  @Permissions('tasks.assign')
  managerDashboard(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.dashboardService.managerDashboard(
      this.getUserId(request),
    );
  }

  // EMPLOYEE + higher permitted roles
  @Get('employee')
  @Permissions('tasks.view')
  employeeDashboard(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.dashboardService.employeeDashboard(
      this.getUserId(request),
    );
  }
}