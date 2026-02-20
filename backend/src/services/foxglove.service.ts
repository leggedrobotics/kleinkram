import { FileAuditService } from '@kleinkram/backend-common/audit/file-audit.service';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import environment from '@kleinkram/backend-common/environment';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { FileEventType, FileType } from '@kleinkram/shared';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'node:crypto';
import { Repository } from 'typeorm';
import logger from '../logger';

/**
 * Service for generating and resolving Foxglove file URLs.
 *
 * These URLs allow temporary access to files for Foxglove Studio.
 * We cannot use the default presigned URLs directly because Foxglove
 * requires a specific URL format ending with `../filename.{bag|mcap}`.
 *
 */
@Injectable()
export class FoxgloveService {
    private readonly LINK_SECRET = environment.JWT_SECRET;
    private readonly BASE_URL = environment.BACKEND_URL;

    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
        private readonly auditService: FileAuditService,
    ) {}

    async generateFoxgloveUrl(uuid: string, user: UserEntity): Promise<string> {
        logger.debug(`Generating Foxglove URL for file UUID: ${uuid}`);
        const file = await this.fileRepository.findOneOrFail({
            where: { uuid },
        });

        // only allow MCAP and BAG files
        const allowedTypes = [FileType.MCAP, FileType.BAG];
        if (!allowedTypes.includes(file.type)) {
            throw new BadRequestException(
                `Foxglove URLs can only be generated for MCAP or BAG files. Found file type: ${FileType[file.type]}`,
            );
        }

        // additional check based on file extension
        const allowedExtensions = ['.mcap', '.bag'];
        if (
            !allowedExtensions.some((extension) =>
                file.filename.toLowerCase().endsWith(extension),
            )
        ) {
            throw new BadRequestException(
                `Foxglove URLs can only be generated for files with .mcap or .bag extension. Found file: ${file.filename}`,
            );
        }

        // Audit the URL generation
        await this.auditService.log(
            FileEventType.FOXGLOVE_URL_GENERATED,
            {
                fileUuid: file.uuid,
                filename: file.filename,
                missionUuid: file.mission?.uuid ?? '',
                actor: user,
            },
            true,
        );

        // Generate signed URL valid for 4 hours
        return this.generateSignedUrl(file.uuid, file.filename, user.uuid);
    }

    async resolveRedirectUrl(
        uuid: string,
        expires: number,
        signature: string,
        userUuid: string,
    ): Promise<string> {
        if (Date.now() > expires) throw new BadRequestException('Link expired');

        const file = await this.fileRepository.findOneOrFail({
            where: { uuid },
        });
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        const dataToSign = `${uuid}:${file.filename}:${expires}:${userUuid}`;
        const expectedSignature = crypto
            .createHmac('sha256', this.LINK_SECRET)
            .update(dataToSign)
            .digest('hex');

        if (signature !== expectedSignature)
            throw new BadRequestException('Invalid signature');

        return await this.dataStorage.getPresignedDownloadUrl(file.uuid, 3600, {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'response-content-disposition': `attachment; filename="${file.filename}"`,
        });
    }

    private generateSignature(data: string): string {
        return crypto
            .createHmac('sha256', this.LINK_SECRET)
            .update(data)
            .digest('hex');
    }

    private generateSignedUrl(
        fileUuid: string,
        filename: string,
        userUuid: string,
    ): string {
        const expires = Date.now() + 4 * 60 * 60 * 1000;
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        const dataToSign = `${fileUuid}:${filename}:${expires}:${userUuid}`;
        const signature = this.generateSignature(dataToSign);
        const cleanFilename = filename.replaceAll(/[^a-zA-Z0-9.-]/g, '_');
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        return `${this.BASE_URL}/integrations/foxglove/${fileUuid}/${cleanFilename}?expires=${expires}&signature=${signature}&u=${userUuid}`;
    }
}
