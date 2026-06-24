import {
    FileEventsDto,
    FileExistsResponseDto,
    FileQueryDto,
    FilesDto,
    FileWithTopicDto,
    StorageOverviewDto,
    TemporaryFileAccessesDto,
    UpdateFile,
} from '@kleinkram/api-dto';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { Injectable } from '@nestjs/common';
import Queue from 'bull';
import { FileLifecycleService } from './file-lifecycle.service';
import { FileQueryService } from './file-query.service';
import { FileStorageService } from './file-storage.service';

@Injectable()
export class FileService {
    constructor(
        private readonly fileQueryService: FileQueryService,
        private readonly fileStorageService: FileStorageService,
        private readonly fileLifecycleService: FileLifecycleService,
    ) {}

    async findMany(
        query: FileQueryDto,
        userUuid: string,
        apiKeyMissionUuid?: string,
    ): Promise<FilesDto> {
        return this.fileQueryService.findMany(
            query,
            userUuid,
            apiKeyMissionUuid,
        );
    }

    async checkResourceAccess(
        projectUuids: string[],
        missionUuids: string[],
        userUuid: string,
    ): Promise<void> {
        return this.fileQueryService.checkResourceAccess(
            projectUuids,
            missionUuids,
            userUuid,
        );
    }

    async checkResourceAccessByName(
        projectNamePatterns: string[],
        missionNamePatterns: string[],
        userUuid: string,
        exactMatch = false,
    ): Promise<void> {
        return this.fileQueryService.checkResourceAccessByName(
            projectNamePatterns,
            missionNamePatterns,
            userUuid,
            exactMatch,
        );
    }

    async findOne(uuid: string): Promise<FileWithTopicDto> {
        return this.fileQueryService.findOne(uuid);
    }

    async getFileEvents(fileUuid: string): Promise<FileEventsDto> {
        return this.fileQueryService.getFileEvents(fileUuid);
    }

    async getActionFileEvents(actionUuid: string): Promise<FileEventsDto> {
        return this.fileQueryService.getActionFileEvents(actionUuid);
    }

    async update(
        uuid: string,
        file: UpdateFile,
        actor?: UserEntity,
        action?: ActionEntity,
    ): Promise<FileEntity | null> {
        return this.fileLifecycleService.update(uuid, file, actor, action);
    }

    async generateDownload(
        uuid: string,
        expires: boolean,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        preview_only: boolean,
        actor?: UserEntity,
        action?: ActionEntity,
    ): Promise<string> {
        return this.fileStorageService.generateDownload(
            uuid,
            expires,
            preview_only,
            actor,
            action,
        );
    }

    async findOneByName(
        missionUUID: string,
        name: string,
    ): Promise<FileEntity | null> {
        return this.fileQueryService.findOneByName(missionUUID, name);
    }

    async moveFiles(
        fileUUIDs: string[],
        missionUUID: string,
        actor?: UserEntity,
        action?: ActionEntity,
    ): Promise<void> {
        return this.fileLifecycleService.moveFiles(
            fileUUIDs,
            missionUUID,
            actor,
            action,
        );
    }

    async deleteFile(
        uuid: string,
        actor?: UserEntity,
        action?: ActionEntity,
    ): Promise<void> {
        return this.fileLifecycleService.deleteFile(uuid, actor, action);
    }

    async getStorage(): Promise<StorageOverviewDto> {
        return this.fileStorageService.getStorage();
    }

    async isUploading(userUUID: string): Promise<boolean> {
        return this.fileLifecycleService.isUploading(userUUID);
    }

    async getTemporaryAccess(
        filenames: string[],
        missionUUID: string,
        userUUID: string,
        action?: ActionEntity,
        uploadSource = 'Web Interface',
    ): Promise<TemporaryFileAccessesDto> {
        return this.fileLifecycleService.getTemporaryAccess(
            filenames,
            missionUUID,
            userUUID,
            action,
            uploadSource,
        );
    }

    async cancelUpload(
        uuids: string[],
        missionUUID: string,
        userUUID: string,
    ): Promise<Queue.Job> {
        return this.fileLifecycleService.cancelUpload(
            uuids,
            missionUUID,
            userUUID,
        );
    }

    async deleteMultiple(
        fileUUIDs: string[],
        missionUUID: string,
    ): Promise<void> {
        return this.fileLifecycleService.deleteMultiple(fileUUIDs, missionUUID);
    }

    async exists(fileUUID: string): Promise<FileExistsResponseDto> {
        return this.fileQueryService.exists(fileUUID);
    }

    async renameTags(): Promise<void> {
        return this.fileStorageService.renameTags();
    }

    async recomputeFileSizes(): Promise<void> {
        return this.fileStorageService.recomputeFileSizes();
    }

    async reextractMissingTopics(): Promise<number> {
        return this.fileLifecycleService.reextractMissingTopics();
    }
}
