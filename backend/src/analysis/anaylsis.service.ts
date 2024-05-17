import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import AnalysisRun from './entities/analysis.entity';
import logger from '../logger';

@Injectable()
export class AnalysisService {
  constructor(
    @InjectRepository(AnalysisRun)
    private analysisRepository: Repository<AnalysisRun>,
  ) {}

  async submit(uuid: string): Promise<void> {
    logger.info(`Creating analysis for file ${uuid}`);
    this.analysisRepository.create({ uuid });
  }
}
