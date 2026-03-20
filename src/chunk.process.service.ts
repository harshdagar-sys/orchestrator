import { Injectable } from '@nestjs/common';

@Injectable()
export class ChunkProcessor {
  async process(chunk: any[], tenantId: string) {
    // save to DB
    // publish to Kafka
    // transform data
  }
}
