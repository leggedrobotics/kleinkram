import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import AnalysisRun from './entities/analysis.entity';
import { SubmitAnalysisRun } from './entities/submit_analysis.dto';
import Token from '../auth/entities/token.entity';
import { TokenTypes } from '../enum';

@Injectable()
export class AnalysisService {
    constructor(
        @InjectRepository(AnalysisRun)
        private analysisRepository: Repository<AnalysisRun>,

        @InjectRepository(Token)
        private tokenRepository: Repository<Token>,
    ) {}

    async submit(data: SubmitAnalysisRun): Promise<AnalysisRun> {
        const now = new Date();
        const newToken = this.tokenRepository.create({
            run: { uuid: data.runUUID },
            tokenType: TokenTypes.CONTAINER,
            deletedAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7),
        });
        const token = await this.tokenRepository.save(newToken);

        // TODO: write to the database
        let run_analysis = this.analysisRepository.create({
            run: { uuid: data.runUUID },
            state: 'PENDING',
            docker_image: data.docker_image,
            token: token,
        });

        await this.analysisRepository.save(run_analysis);

        // return the created analysis run
        run_analysis = await this.analysisRepository.findOne({
            where: { uuid: run_analysis.uuid },
            relations: ['run', 'run.project'],
        });

        return run_analysis;
    }

    async list(run_uuids: string): Promise<AnalysisRun[]> {
        return await this.analysisRepository.find({
            where: { run: { uuid: run_uuids } },
            relations: ['run', 'run.project'],
            order: { createdAt: 'DESC' },
        });
    }

    async details(analysis_uuid: string) {
        return await this.analysisRepository.findOne({
            where: { uuid: analysis_uuid },
            relations: ['run', 'run.project'],
        });
    }
}
