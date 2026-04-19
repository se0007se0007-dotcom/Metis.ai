import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CurrentUser, RequestUser } from '../../common/decorators';

@ApiTags('Tenant')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant context' })
  async getCurrent(@CurrentUser() user: RequestUser) {
    return this.tenantService.findById(user.tenantId);
  }

  @Get('current/members')
  @ApiOperation({ summary: 'List members of current tenant' })
  async getMembers(@CurrentUser() user: RequestUser) {
    return this.tenantService.getMemberships(user.tenantId);
  }
}
