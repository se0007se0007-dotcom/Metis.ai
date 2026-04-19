import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentKernelRedisProvider } from './redis.provider';
import { A2ABusService } from './bus.service';
import { MissionService } from './mission.service';
import { HandoffService } from './handoff.service';
import { MissionController } from './mission.controller';
import { AgentDispatcherService } from './dispatcher.service';
import { LocalAgentsService } from './local-agents.service';
import { CapabilityRegistryModule } from '../capability-registry/capability-registry.module';

@Module({
  imports: [ConfigModule, CapabilityRegistryModule],
  controllers: [MissionController],
  providers: [
    AgentKernelRedisProvider,
    A2ABusService,
    MissionService,
    HandoffService,
    AgentDispatcherService,
    LocalAgentsService,
  ],
  exports: [AgentKernelRedisProvider, A2ABusService, MissionService, HandoffService, AgentDispatcherService],
})
export class AgentKernelModule {}
