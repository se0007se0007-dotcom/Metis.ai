import { Module } from '@nestjs/common';
import { FinOpsController } from './finops.controller';
import { FinOpsPredictionController } from './finops-prediction.controller';
import { FinOpsService } from './finops.service';
import { FinOpsPredictionService } from './finops-prediction.service';
import { TokenOptimizerService } from './token-optimizer.service';

@Module({
  controllers: [FinOpsController, FinOpsPredictionController],
  providers: [FinOpsService, FinOpsPredictionService, TokenOptimizerService],
  exports: [FinOpsService, FinOpsPredictionService, TokenOptimizerService],
})
export class FinOpsModule {}
