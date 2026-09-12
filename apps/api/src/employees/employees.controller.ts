import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateHrJoinRequestDto } from './dto/create-hr-join-request.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ActivateEmployeeLoginDto } from './dto/activate-employee-login.dto';
import { UpdateEmployeeLoginDto } from './dto/update-employee-login.dto';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';
import { EmployeesService } from './employees.service';

type AuthenticatedRequest = {
  user?: {
    id?: string;
    roles?: string[];
  };
};

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class EmployeesController {
  constructor(
    private readonly employeesService:
      EmployeesService,
  ) {}

  @Get()
  @Permissions('employees.view')
  findAll(
    @Query()
    query: EmployeeQueryDto,
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.findAll(
      query,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Get('team-directory')
  findTeamDirectory(
    @Query()
    query: EmployeeQueryDto,
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.findTeamDirectory(
      query,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Get('me')
  @Permissions('employees.view')
  findMe(
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.findMe(
      request?.user?.id,
    );
  }

  @Get('super-admins')
  @Permissions('employees.manage')
  findSuperAdmins(
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.findSuperAdmins({
      userId: request?.user?.id,
      roles: request?.user?.roles,
    });
  }

  @Post('super-admins')
  @Permissions('employees.manage')
  createSuperAdmin(
    @Body()
    dto: CreateSuperAdminDto,
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.createSuperAdmin(
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Get('hr-dashboard')
  @Permissions('employees.view')
  getHrDashboard(
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.getHrDashboard({
      userId: request?.user?.id,
      roles: request?.user?.roles,
    });
  }

  @Post('hr-join-requests')
  @Permissions('employees.view')
  createHrJoinRequest(
    @Body()
    dto: CreateHrJoinRequestDto,
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.createHrJoinRequest(
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Post('admin-password-reset/:userId')
  @Permissions('employees.manage')
  adminResetPassword(
    @Param('userId') userId: string,
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.adminResetPassword(
      userId,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }


  @Post(':id/activate-login')
  @Permissions('employees.manage')
  activateLogin(
    @Param('id') id: string,
    @Body()
    dto: ActivateEmployeeLoginDto,
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.activateWorkspaceLogin(
      id,
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Patch(':id/login')
  @Permissions('employees.manage')
  updateLogin(
    @Param('id') id: string,
    @Body()
    dto: UpdateEmployeeLoginDto,
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.updateWorkspaceLogin(
      id,
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Get(':id')
  @Permissions('employees.view')
  findOne(
    @Param('id') id: string,
  ) {
    return this.employeesService.findOne(
      id,
    );
  }

  @Post()
  @Permissions('employees.manage')
  create(
    @Body()
    dto: CreateEmployeeDto,
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.create(
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Patch(':id')
  @Permissions('employees.manage')
  update(
    @Param('id') id: string,
    @Body()
    dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(
      id,
      dto,
    );
  }

  @Delete(':id')
  @Permissions('employees.manage')
  remove(
    @Param('id') id: string,
    @Req()
    request?: AuthenticatedRequest,
  ) {
    return this.employeesService.remove(
      id,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }
}
