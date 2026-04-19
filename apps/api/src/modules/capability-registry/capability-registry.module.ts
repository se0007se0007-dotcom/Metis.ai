import { Module } from '@nestjs/common';
import { CapabilityRegistryService } from './capability-registry.service';
import { AgentRegistryService } from './agent-registry.service';
import { CapabilityRegistryController } from './capability-registry.controller';
import { AdapterInvocationService } from './adapter-invocation.service';

@Module({
  controllers: [CapabilityRegistryController],
  providers: [CapabilityRegistryService, AgentRegistryService, AdapterInvocationService],
  exports: [CapabilityRegistryService, AgentRegistryService, AdapterInvocationService],
})
export class CapabilityRegistryModule {}
