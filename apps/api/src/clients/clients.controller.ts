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

import { ClientsService } from './clients.service';
import { ClientQueryDto } from './dto/client-query.dto';
import { CreateClientContactDto } from './dto/create-client-contact.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientAccountsDto } from './dto/update-client-accounts.dto';
import { UpdateClientContactDto } from './dto/update-client-contact.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateClientOnboardingDto } from './dto/update-client-onboarding.dto';
import { ManageClientApprovalDto } from './dto/manage-client-approval.dto';
import { ManageQuotationApprovalDto } from './dto/manage-quotation-approval.dto';

type AuthenticatedRequest = {
  user?: {
    id?: string;
    roles?: string[];
  };
};

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
  ) {}

  @Get()
  @Permissions('clients.view')
  findAll(
    @Query() query: ClientQueryDto,
  ) {
    return this.clientsService.findAll(query);
  }

  @Get('workflow-access')
  @Permissions('clients.view')
  workflowAccess(
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.clientsService.getWorkflowAccess({
      userId: request?.user?.id,
      roles: request?.user?.roles,
    });
  }

  @Get('accounts-dashboard')
  @Permissions('clients.view')
  accountsDashboard(
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.clientsService.getAccountsDashboard({
      userId: request?.user?.id,
      roles: request?.user?.roles,
    });
  }

  @Get('client-servicing-dashboard')
  @Permissions('clients.view')
  clientServicingDashboard(
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.clientsService.getClientServicingDashboard({
      userId: request?.user?.id,
      roles: request?.user?.roles,
    });
  }

  @Get(':id')
  @Permissions('clients.view')
  findOne(
    @Param('id') id: string,
  ) {
    return this.clientsService.findOne(id);
  }

  @Post()
  @Permissions('clients.view')
  create(
    @Body() dto: CreateClientDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.clientsService.create(
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Patch(':id')
  @Permissions('clients.view')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.clientsService.update(
      id,
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Patch(':id/onboarding')
  @Permissions('clients.view')
  updateOnboarding(
    @Param('id') id: string,
    @Body() dto: UpdateClientOnboardingDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.clientsService.updateOnboarding(
      id,
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Patch(':id/manage-approval')
  @Permissions('clients.view')
  manageApproval(
    @Param('id') id: string,
    @Body() dto: ManageClientApprovalDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.clientsService.manageClientApproval(
      id,
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }


  @Patch(':id/quotation-approval')
  @Permissions('clients.view')
  quotationApproval(
    @Param('id') id: string,
    @Body() dto: ManageQuotationApprovalDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.clientsService.manageQuotationApproval(
      id,
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Patch(':id/accounts')
  @Permissions('clients.view')
  updateAccounts(
    @Param('id') id: string,
    @Body() dto: UpdateClientAccountsDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.clientsService.updateAccounts(
      id,
      dto,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Post(':id/close')
  @Permissions('clients.view')
  closeClient(
    @Param('id') id: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.clientsService.closeClient(
      id,
      {
        userId: request?.user?.id,
        roles: request?.user?.roles,
      },
    );
  }

  @Delete(':id')
  @Permissions('clients.manage')
  remove(
    @Param('id') id: string,
  ) {
    return this.clientsService.remove(id);
  }

  @Post(':id/contacts')
  @Permissions('clients.manage')
  addContact(
    @Param('id') clientId: string,
    @Body() dto: CreateClientContactDto,
  ) {
    return this.clientsService.addContact(
      clientId,
      dto,
    );
  }

  @Patch(':id/contacts/:contactId')
  @Permissions('clients.manage')
  updateContact(
    @Param('id') clientId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateClientContactDto,
  ) {
    return this.clientsService.updateContact(
      clientId,
      contactId,
      dto,
    );
  }

  @Delete(':id/contacts/:contactId')
  @Permissions('clients.manage')
  removeContact(
    @Param('id') clientId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.clientsService.removeContact(
      clientId,
      contactId,
    );
  }
}
