import { Process, Processor } from '@nestjs/bull';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Mission from '@common/entities/mission/mission.entity';
import { Repository } from 'typeorm';
import FileEntity from '@common/entities/file/file.entity';
import { FileState } from '@common/enum';
import { moveMissionFilesInMinio } from '@common/minio_helper';
import env from '@common/env';
import Project from '@common/entities/project/project.entity';
import logger from '../logger';

@Processor('move')
@Injectable()
export class MoveMissionProvider {
    constructor(
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
    ) {}

    @Process({ concurrency: 5, name: 'mission' })
    async process(job: { data: { missionUUID: string; projectUUID: string } }) {
        const { missionUUID, projectUUID } = job.data;
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project', 'files'],
        });
        logger.debug(`Moving mission: ${mission.name}`);
        const old_project = mission.project;
        const newProject = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: ['missions'],
        });
        if (newProject.missions.find((m) => m.name === mission.name)) {
            throw new ConflictException(
                'Mission with this name already exists in the project',
            );
        }

        mission.project = newProject;
        await this.missionRepository.save(mission);
        await Promise.all(
            mission.files.map((f) => {
                f.state = FileState.MOVING;
                this.fileRepository.save(f);
                logger.debug(`State of file ${f.filename} set to MOVING`);
            }),
        );
        await moveMissionFilesInMinio(
            `${old_project.name}/${mission.name}`,
            `${mission.project.name}/${mission.name}`,
            env.MINIO_BAG_BUCKET_NAME,
        );
        await moveMissionFilesInMinio(
            `${old_project.name}/${mission.name}`,
            `${mission.project.name}/${mission.name}`,
            env.MINIO_MCAP_BUCKET_NAME,
        );
        await Promise.all(
            mission.files.map((f) => {
                f.state = FileState.OK;
                this.fileRepository.save(f);
                logger.debug(`State of file ${f.filename} set to OK`);
            }),
        );
        return await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project', 'files'],
        });
    }
}
