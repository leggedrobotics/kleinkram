import { Controller } from '@nestjs/common';
import { RunService } from './run.service';

@Controller('run')
export class RunController {
  constructor(private readonly runService: RunService) {}
}
