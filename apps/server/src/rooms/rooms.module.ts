import { Module } from '@nestjs/common';
import { DevConsoleService } from '../dev/dev-console.service.js';
import { devModeProvider } from '../dev/dev-mode.js';
import { DevSnapshots } from '../dev/dev-snapshots.js';
import { RoomsGateway } from './rooms.gateway.js';
import { RoomsService } from './rooms.service.js';

@Module({
  providers: [devModeProvider, DevSnapshots, DevConsoleService, RoomsService, RoomsGateway],
})
export class RoomsModule {}
