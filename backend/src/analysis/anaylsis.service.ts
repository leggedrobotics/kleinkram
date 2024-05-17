import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import AnalysisRun from './entities/analysis.entity';
import { SubmitAnalysisRun } from './entities/submit_analysis.dto';

@Injectable()
export class AnalysisService {
  constructor(
    @InjectRepository(AnalysisRun)
    private analysisRepository: Repository<AnalysisRun>,
  ) {}

  async submit(data: SubmitAnalysisRun): Promise<AnalysisRun> {
    // TODO: write to the database
    let run_analysis = this.analysisRepository.create({
      run: { uuid: data.runUUID },
      state: 'PENDING',
      docker_image: data.docker_image,
    });

    await this.analysisRepository.save(run_analysis);

    // return the created analysis run
    run_analysis = await this.analysisRepository.findOne({
      where: { uuid: run_analysis.uuid },
      relations: ['run', 'run.project'],
    });

    return run_analysis;
  }

  async list(project_uuid: string, run_uuids: string): Promise<AnalysisRun[]> {
    return await this.analysisRepository.find({
      where: { run: { uuid: run_uuids } },
      relations: ['run', 'run.project'],
    });
  }
}
