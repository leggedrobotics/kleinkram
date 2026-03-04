import { OutputDto } from '@/decorators';
import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import path from 'node:path';

@Controller()
export class FaviconController {
    @Get('favicon.ico')
    @ApiExcludeEndpoint()
    @OutputDto(null)
    serveFavicon(@Res() response: Response): void {
        response.sendFile(path.join(__dirname, '..', 'assets', 'favicon.png'));
    }
}
