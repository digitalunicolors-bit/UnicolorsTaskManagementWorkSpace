import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
  ) {}

  private userId(
    request: any,
  ) {
    const id =
      request?.user?.id ??
      request?.user?.sub;

    if (!id) {
      throw new UnauthorizedException();
    }

    return String(id);
  }

  @Get('options')
  @Permissions('reports.view')
  options(
    @Req()
    request: any,
  ) {
    return this.reportsService.options(
      this.userId(request),
    );
  }

  @Get('data')
  @Permissions('reports.view')
  data(
    @Req()
    request: any,
    @Query('start')
    start?: string,
    @Query('end')
    end?: string,
    @Query('employeeId')
    employeeId?: string,
    @Query('departmentId')
    departmentId?: string,
    @Query('clientId')
    clientId?: string,
    @Query('projectId')
    projectId?: string,
    @Query('statusId')
    statusId?: string,
    @Query('priority')
    priority?: string,
  ) {
    return this.reportsService.data(
      this.userId(request),
      {
        start,
        end,
        employeeId,
        departmentId,
        clientId,
        projectId,
        statusId,
        priority,
      },
    );
  }
}
