import { Controller, Get } from '@nestjs/common';
import { gameList } from '@psc/shared';

@Controller('api')
export class HealthController {
  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('games')
  games() {
    return gameList;
  }
}
