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
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamMembersDto } from './dto/team-members.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('teams')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class TeamsController {
  constructor(
    private readonly teamsService:
      TeamsService,
  ) {}

  @Get()
  @Permissions('teams.view')
  findAll() {
    return this.teamsService.findAll();
  }

  @Get(':id')
  @Permissions('teams.view')
  findOne(
    @Param('id') id: string,
  ) {
    return this.teamsService.findOne(
      id,
    );
  }

  @Post()
  @Permissions('teams.manage')
  create(
    @Body()
    dto: CreateTeamDto,
  ) {
    return this.teamsService.create(
      dto,
    );
  }

  @Patch(':id')
  @Permissions('teams.manage')
  update(
    @Param('id') id: string,
    @Body()
    dto: UpdateTeamDto,
  ) {
    return this.teamsService.update(
      id,
      dto,
    );
  }

  @Post(':id/members')
  @Permissions('teams.manage')
  addMembers(
    @Param('id') id: string,
    @Body()
    dto: TeamMembersDto,
  ) {
    return this.teamsService.addMembers(
      id,
      dto,
    );
  }

  @Delete(':id/members')
  @Permissions('teams.manage')
  removeMembers(
    @Param('id') id: string,
    @Body()
    dto: TeamMembersDto,
  ) {
    return this.teamsService.removeMembers(
      id,
      dto,
    );
  }

  @Delete(':id')
  @Permissions('teams.manage')
  remove(
    @Param('id') id: string,
  ) {
    return this.teamsService.remove(
      id,
    );
  }
}