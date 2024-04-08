import { Injectable } from '@nestjs/common';
import Run from './entities/run.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class RunService {
  constructor(@InjectRepository(Run) private runRepository: Repository<Run>) {}
}
