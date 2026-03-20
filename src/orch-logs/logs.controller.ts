import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { LogsService } from './logs.service';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('download')
  async download(
    @Query('date') date: string | undefined,
    @Query('blobName') blobName: string | undefined,
    @Res() res: Response,
  ) {
    const { fileName, content } =
      await this.logsService.downloadOrchestratorLog({ date, blobName });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(content);
  }
}

