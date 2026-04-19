/**
 * Builder Module — workflow authoring hub.
 *
 * LLM Planner Configuration:
 *   Default: HeuristicPlannerAdapter (zero dependencies, deterministic)
 *   To upgrade: Change useClass to OpenAIPlannerAdapter + set OPENAI_API_KEY
 *     { provide: 'LLM_PLANNER_ADAPTER', useClass: OpenAIPlannerAdapter }
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BuilderController } from './builder.controller';
import { BuilderPlannerService } from './builder-planner.service';
import { BuilderValidationService } from './builder-validation.service';
import { BuilderEvalService } from './builder-eval.service';
import { CapabilityPlannerService } from './capability-planner.service';
import { CapabilityPlannerController } from './capability-planner.controller';
import { HeuristicPlannerAdapter } from './llm-planner/heuristic-planner-adapter';
import { ConnectorModule } from '../connector/connector.module';
import { GovernanceModule } from '../governance/governance.module';
import { CapabilityRegistryModule } from '../capability-registry/capability-registry.module';

@Module({
  imports: [ConfigModule, ConnectorModule, GovernanceModule, CapabilityRegistryModule],
  controllers: [BuilderController, CapabilityPlannerController],
  providers: [
    BuilderPlannerService,
    BuilderValidationService,
    BuilderEvalService,
    CapabilityPlannerService,
    { provide: 'LLM_PLANNER_ADAPTER', useClass: HeuristicPlannerAdapter },
  ],
  exports: [
    BuilderPlannerService,
    BuilderValidationService,
    BuilderEvalService,
    CapabilityPlannerService,
  ],
})
export class BuilderModule {}
