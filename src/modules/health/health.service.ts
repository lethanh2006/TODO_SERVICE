import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ConnectionStates, type Connection } from 'mongoose';

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  getHealth(): { status: 'ok'; service: 'todo' } {
    return { status: 'ok', service: 'todo' };
  }

  getReadiness(): {
    status: 'ok' | 'error';
    service: 'todo';
    dependencies: { mongodb: 'up' | 'down' };
  } {
    const mongodb: 'up' | 'down' =
      this.connection.readyState === ConnectionStates.connected ? 'up' : 'down';
    const result = {
      status: mongodb === 'up' ? ('ok' as const) : ('error' as const),
      service: 'todo' as const,
      dependencies: { mongodb },
    };
    if (mongodb === 'down') throw new ServiceUnavailableException(result);
    return result;
  }
}
