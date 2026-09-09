import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ManualTimeEntryDto, StartTimeEntryDto } from './dto/time-entry.dto';
import { TimeEntryQueryDto } from './dto/time-entry-query.dto';
import { TimeEntriesService } from './time-entries.service';

@ApiTags('Time Entries')
@ApiBearerAuth()
@Controller('time-entries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TimeEntriesController {
  constructor(private readonly service: TimeEntriesService) {}

  private userId(request: any) {
    const id = request?.user?.id ?? request?.user?.sub;
    if (!id) throw new UnauthorizedException();
    return String(id);
  }

  @Get('options')
  @Permissions('time.manage_own')
  options(@Req() request: any) {
    return this.service.getOptions(this.userId(request));
  }

  @Get('current')
  @Permissions('time.manage_own')
  current(@Req() request: any) {
    return this.service.getCurrent(this.userId(request));
  }

  @Get('summary')
  @Permissions('time.manage_own')
  summary(@Req() request: any, @Query() query: TimeEntryQueryDto) {
    return this.service.getSummary(this.userId(request), query);
  }

  @Get()
  @Permissions('time.manage_own')
  list(@Req() request: any, @Query() query: TimeEntryQueryDto) {
    return this.service.list(this.userId(request), query);
  }

  @Post('start')
  @Permissions('time.manage_own')
  start(@Req() request: any, @Body() dto: StartTimeEntryDto) {
    return this.service.start(this.userId(request), dto);
  }

  @Post('manual')
  @Permissions('time.manage_own')
  manual(@Req() request: any, @Body() dto: ManualTimeEntryDto) {
    return this.service.manual(this.userId(request), dto);
  }

  @Patch(':id/pause')
  @Permissions('time.manage_own')
  pause(@Req() request: any, @Param('id') id: string) {
    return this.service.pause(this.userId(request), id);
  }

  @Patch(':id/resume')
  @Permissions('time.manage_own')
  resume(@Req() request: any, @Param('id') id: string) {
    return this.service.resume(this.userId(request), id);
  }

  @Patch(':id/stop')
  @Permissions('time.manage_own')
  stop(@Req() request: any, @Param('id') id: string) {
    return this.service.stop(this.userId(request), id);
  }
}
