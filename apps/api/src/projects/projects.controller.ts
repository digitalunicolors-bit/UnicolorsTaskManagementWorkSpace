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

import { ProjectsService } from './projects.service';

import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectClientChangesDto, ProjectReviewActionDto } from './dto/project-review-action.dto';
import { ProjectQueryDto } from './dto/project-query.dto';

import { AddProjectMembersDto } from './dto/add-project-members.dto';
import { RemoveProjectMembersDto } from './dto/remove-project-members.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';

import { CreateProjectMilestoneDto } from './dto/create-project-milestone.dto';
import { UpdateProjectMilestoneDto } from './dto/update-project-milestone.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

type AuthenticatedRequest = {
  user?: {
    id?: string;
    roles?: string[];
  };
};

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  @Permissions('projects.view')
  findAll(
    @Query()
    query: ProjectQueryDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.projectsService.findAll(
      query,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Get(':id')
  @Permissions('projects.view')
  findOne(
    @Param('id') id: string,
  ) {
    return this.projectsService.findOne(
      id,
    );
  }

  @Post()
  @Permissions('projects.manage')
  create(
    @Body()
    dto: CreateProjectDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.projectsService.create(
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Patch(':id')
  @Permissions('projects.manage')
  update(
    @Param('id') id: string,
    @Body()
    dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(
      id,
      dto,
    );
  }

  @Delete(':id')
  @Permissions('projects.manage')
  remove(
    @Param('id') id: string,
  ) {
    return this.projectsService.remove(
      id,
    );
  }

  @Post(':id/send-to-client')
  @Permissions('projects.manage')
  sendToClient(
    @Param('id') id: string,
    @Body() dto: ProjectReviewActionDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.projectsService.sendToClient(
      id,
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Post(':id/client-approved')
  @Permissions('projects.manage')
  clientApproved(
    @Param('id') id: string,
    @Body() dto: ProjectReviewActionDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.projectsService.clientApproved(
      id,
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Post(':id/client-changes')
  @Permissions('projects.manage')
  clientChanges(
    @Param('id') id: string,
    @Body() dto: ProjectClientChangesDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.projectsService.clientChanges(
      id,
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Post(':id/members')
  @Permissions('projects.manage')
  addMembers(
    @Param('id')
    projectId: string,
    @Body()
    dto: AddProjectMembersDto,
  ) {
    return this.projectsService.addMembers(
      projectId,
      dto,
    );
  }

  @Delete(':id/members')
  @Permissions('projects.manage')
  removeMembers(
    @Param('id')
    projectId: string,
    @Body()
    dto: RemoveProjectMembersDto,
  ) {
    return this.projectsService.removeMembers(
      projectId,
      dto,
    );
  }

  @Patch(
    ':id/members/:employeeId',
  )
  @Permissions('projects.manage')
  updateMember(
    @Param('id')
    projectId: string,

    @Param('employeeId')
    employeeId: string,

    @Body()
    dto: UpdateProjectMemberDto,
  ) {
    return this.projectsService.updateMember(
      projectId,
      employeeId,
      dto,
    );
  }

  @Post(':id/milestones')
  @Permissions('projects.manage')
  createMilestone(
    @Param('id')
    projectId: string,

    @Body()
    dto: CreateProjectMilestoneDto,
  ) {
    return this.projectsService.createMilestone(
      projectId,
      dto,
    );
  }

  @Patch(
    ':id/milestones/:milestoneId',
  )
  @Permissions('projects.manage')
  updateMilestone(
    @Param('id')
    projectId: string,

    @Param('milestoneId')
    milestoneId: string,

    @Body()
    dto: UpdateProjectMilestoneDto,
  ) {
    return this.projectsService.updateMilestone(
      projectId,
      milestoneId,
      dto,
    );
  }

  @Delete(
    ':id/milestones/:milestoneId',
  )
  @Permissions('projects.manage')
  removeMilestone(
    @Param('id')
    projectId: string,

    @Param('milestoneId')
    milestoneId: string,
  ) {
    return this.projectsService.removeMilestone(
      projectId,
      milestoneId,
    );
  }
}