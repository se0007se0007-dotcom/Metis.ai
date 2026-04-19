import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GovernanceService } from './governance.service';
import { CurrentUser, RequestUser, Roles } from '../../common/decorators';

@ApiTags('Governance')
@ApiBearerAuth()
@Controller('governance')
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get('audit-logs')
  @Roles('AUDITOR')
  @ApiOperation({ summary: 'Search audit logs' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'correlationId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getAuditLogs(
    @CurrentUser() user: RequestUser,
    @Query('action') action?: string,
    @Query('correlationId') correlationId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.governanceService.getAuditLogs(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      {
        action,
        correlationId,
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      },
    );
  }

  @Get('policies')
  @Roles('AUDITOR')
  @ApiOperation({ summary: 'List policies' })
  async getPolicies(@CurrentUser() user: RequestUser) {
    const items = await this.governanceService.getPolicies({
      tenantId: user.tenantId,
      userId: user.userId,
      role: user.role,
    });
    return { items };
  }
}
