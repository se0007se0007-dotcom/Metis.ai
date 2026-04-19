import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { CurrentUser, RequestUser } from '../../common/decorators';

@ApiTags('Knowledge')
@ApiBearerAuth()
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('artifacts')
  @ApiOperation({ summary: 'List knowledge artifacts' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'status', required: false })
  async list(
    @CurrentUser() user: RequestUser,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    const items = await this.knowledgeService.list(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      { category, status },
    );
    return { items };
  }
}
