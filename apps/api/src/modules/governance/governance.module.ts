import { Module } from '@nestjs/common';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';
import { PolicyService } from './policy.service';

@Module({
  controllers: [GovernanceController],
  providers: [GovernanceService, PolicyService],
  exports: [GovernanceService, PolicyService],
})
export class GovernanceModule {}
