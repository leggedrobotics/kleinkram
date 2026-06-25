import { StorageOverviewDto } from '@kleinkram/api-dto';
import { FileAuditService } from '@kleinkram/backend-common/audit/file-audit.service';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import {
    IStorageBucket,
    StorageItem,
} from '@kleinkram/backend-common/modules/storage/types';
import { FileEventType, FileState } from '@kleinkram/shared';
import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import logger from '../logger';

@Injectable()
export class FileStorageService {
    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
        private readonly auditService: FileAuditService,
    ) {}

    async generateDownload(
        uuid: string,
        expires: boolean,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        preview_only: boolean,
        actor?: UserEntity,
        action?: ActionEntity,
    ): Promise<string> {
        // verify that an uuid is provided
        if (!uuid || uuid === '')
            throw new BadRequestException('UUID is required');

        const file = await this.fileRepository.findOneOrFail({
            where: { uuid },
            relations: ['mission'],
        });

        // verify that the file exists in DB
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (file.uuid === undefined || file.uuid !== uuid)
            throw new BadRequestException('File not found');

        const stats = await this.dataStorage.getFileInfo(file.uuid);

        // verify that the file exists in storage
        if (!stats) throw new NotFoundException('File not found');

        // TODO: find a better solution to avoid leaking download links without logging
        //    we use that to preview the messages without spamming the audit log
        if (!preview_only) {
            await this.auditService.log(
                FileEventType.DOWNLOADED,
                {
                    fileUuid: file.uuid,
                    filename: file.filename,
                    missionUuid: file.mission?.uuid ?? '',
                    details: { expiresIn: expires ? '4 hours' : '1 week' },
                    ...(actor ? { actor } : {}),
                    ...(action ? { action } : {}),
                },
                true,
            );
        }

        const disposition = preview_only
            ? undefined
            : {
                  'response-content-disposition': `attachment; filename="${file.filename}"`,
              };

        return await this.dataStorage.getPresignedDownloadUrl(
            file.uuid,
            expires ? 4 * 60 * 60 : 604_800,
            disposition,
        );
    }

    async getStorage(): Promise<StorageOverviewDto> {
        const metrics = await this.dataStorage.getSystemMetrics?.();
        if (!metrics) {
            return {
                usedBytes: 0,
                totalBytes: 0,
                usedInodes: 0,
                totalInodes: 0,
            };
        }

        return metrics;
    }

    async renameTags(): Promise<void> {
        const filesList = await this.dataStorage.listFiles();

        await Promise.all(
            filesList.map(async (file: StorageItem): Promise<void> => {
                if (!file.name) {
                    logger.debug(`Filename is empty: ${JSON.stringify(file)}`);
                    return;
                }
                const fileEntity = await this.fileRepository.findOne({
                    where: { uuid: file.name },
                    relations: ['mission', 'mission.project'],
                });
                if (fileEntity === null) {
                    logger.error(`File ${file.name} not found in database`);
                    return;
                }

                await this.dataStorage.removeTags(file.name);

                if (fileEntity.mission === undefined)
                    throw new Error('Mission not found!');
                if (fileEntity.mission.project === undefined)
                    throw new Error('Project not found!');

                await this.dataStorage.addTags(file.name, {
                    projectUuid: fileEntity.mission.project.uuid,
                    missionUuid: fileEntity.mission.uuid,
                    filename: fileEntity.filename,
                });
            }),
        ).catch((error: unknown) => {
            logger.error(error);
        });
    }

    async recomputeFileSizes(): Promise<void> {
        const files = await this.fileRepository.find({
            where: {
                state: In([FileState.OK, FileState.FOUND]),
            },
        });
        await Promise.all(
            files.map(async (file) => {
                const stats = await this.dataStorage.getFileInfo(file.uuid);

                if (stats) {
                    file.size = stats.size;
                    logger.debug(
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                        `Updated size for ${file.filename}: ${file.size?.toString()}`,
                    );
                } else {
                    logger.error(
                        `File ${file.uuid} not found in storage, setting state to LOST`,
                    );
                    file.state = FileState.LOST;
                }
                await this.fileRepository.save(file);
            }),
        );
    }
}
