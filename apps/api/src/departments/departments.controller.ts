import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentsService } from './departments.service';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class DepartmentsController {
  constructor(
    private readonly departmentsService:
      DepartmentsService,
  ) {}

  @Get()
  @Permissions('departments.view')
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @Permissions('departments.view')
  findOne(
    @Param('id') id: string,
  ) {
    return this.departmentsService.findOne(
      id,
    );
  }

  @Post()
  @Permissions('departments.manage')
  create(
    @Body()
    dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(
      dto,
    );
  }

  @Patch(':id')
  @Permissions('departments.manage')
  update(
    @Param('id') id: string,
    @Body()
    dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(
      id,
      dto,
    );
  }

  @Delete(':id')
  @Permissions('departments.manage')
  remove(
    @Param('id') id: string,
  ) {
    return this.departmentsService.remove(
      id,
    );
  }
}