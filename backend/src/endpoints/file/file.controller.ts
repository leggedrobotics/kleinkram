import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { FileService } from '../../services/file.service';
import { UpdateFile } from '@common/api/types/update-file.dto';
import logger from '../../logger';
import {
    AdminOnly,
    CanCreateInMissionByBody,
    CanDeleteFile,
    CanDeleteMission,
    CanMoveFiles,
    CanReadFile,
    CanReadMission,
    CanWriteFile,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';
import { PaginatedQueryDto } from '@common/api/types/pagination.dto';
import { FileType } from '@common/frontend_shared/enum';
import { BodyUUID, BodyUUIDArray } from '../../validation/body-decorators';
import env from '@common/environment';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { StorageOverviewDto } from '@common/api/types/storage-overview.dto';
import { NoQueryParametersDto } from '@common/api/types/no-query-parameters.dto';
import { IsUploadingDto } from '@common/api/types/file/is-uploading.dto';
import { FilesDto } from '@common/api/types/file/files.dto';
import { FileWithTopicDto } from '@common/api/types/file/file.dto';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { CreatePreSignedURLSDto } from '@common/api/types/create-pre-signed-url.dto';
import {
    FileExistsResponseDto,
    TemporaryFileAccessesDto,
} from '@common/api/types/file/access.dto';
import {
    IsEnum,
    IsString,
    IsUUID,
    IsOptional,
    IsArray,
    IsDate,
    IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

import { FileQueryDto } from '@common/api/types/file/file-query.dto';
class OnlyUuidParams {
    @IsUUID()
    @ApiProperty()
    uuid!: string;
}

class OneByNameFileDto {
    @IsUUID()
    @ApiProperty()
    uuid!: string;

    @IsString()
    @ApiProperty()
    filename!: string;
}

class OfMissionFileDto {
    @IsOptional()
    @IsString()
    @ApiProperty()
    filename?: string;

    @IsOptional()
    @IsEnum(FileType)
    @ApiProperty()
    filetype: FileType = FileType.ALL;

    @IsUUID()
    @ApiProperty()
    uuid!: string; // mission uuid

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @ApiProperty()
    categories?: string[];
}

class SortParams {
    @IsOptional()
    @IsString()
    @ApiProperty()
    sort: string = 'uuid';

    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    @ApiProperty()
    sortDirection: 'ASC' | 'DESC' = 'ASC';
}

class FilteredParams {
    @IsString()
    @ApiProperty()
    fileName!: string;

    @IsUUID()
    @ApiProperty()
    projectUUID!: string;

    @IsUUID()
    @ApiProperty()
    missionUUID!: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @ApiProperty()
    topics?: string[];
}

class ExistsParams {
    @IsUUID()
    @ApiProperty()
    uuid!: string;
}

class DateRangeParams {
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    @ApiProperty()
    startDate?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    @ApiProperty()
    endDate?: Date;
}

class AndOrParam {
    @IsIn(['true', 'false'])
    @Transform(({ value }) => value === 'true')
    @ApiProperty()
    andOr!: boolean;
}

class FilteredFilesDto {
    @IsOptional()
    @IsString()
    @ApiProperty()
    projectName: string = '';

    @IsOptional()
    @IsString()
    @ApiProperty()
    missionName: string = '';

    @IsOptional()
    @IsString()
    @ApiProperty()
    topics: string = '';
}

class FileTypeParam {
    @IsOptional()
    @IsIn(['bag', 'mcap', 'bag,mcap'])
    @ApiProperty()
    fileTypes: string = '';
}

class DownloadParams {
    @IsUUID()
    @ApiProperty()
    uuid!: string;

    @IsIn(['true', 'false'])
    @Transform(({ value }) => value === 'true')
    @ApiProperty()
    expires!: boolean;
}

class HealthParam {
    @IsOptional()
    @IsString()
    @ApiProperty()
    health: string = '';
}

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Get('all')
    @UserOnly()
    @ApiOkResponse({
        description: 'Filtered Files',
        type: FilesDto,
    })
    async allFiles(
        @Query() { take, skip }: PaginatedQueryDto,
        @AddUser() auth: AuthHeader,
    ): Promise<FilesDto> {
        return await this.fileService.findAll(auth.user.uuid, take, skip);
    }

    // TODO: remove this endpoint, it is not used anywhere
    @Get('filteredByNames')
    @UserOnly()
    @ApiOkResponse({
        description: 'Filtered Files',
        type: FilesDto,
    })
    async filteredByNames(
        @Query() query: PaginatedQueryDto & FilteredFilesDto,
        @AddUser() auth: AuthHeader,
    ): Promise<FilesDto> {
        const tags = {}; // TODO allow for querying by tags

        return await this.fileService.findFilteredByNames(
            query.projectName,
            query.missionName,
            query.topics,
            auth.user.uuid,
            query.take,
            query.skip,
            tags,
        );
    }

    @Get('many')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Many Files',
        type: FilesDto,
    })
    async getMany(@Query() query: FileQueryDto, @AddUser() auth: AuthHeader) {
        return await this.fileService.findMany(
            query.projectUuids ?? [],
            query.projectPatterns ?? [],
            query.missionUuids ?? [],
            query.missionPatterns ?? [],
            query.fileUuids ?? [],
            query.filePatterns ?? [],
            query.take,
            query.skip,
            auth.user.uuid,
        );
    }

    @Get('filtered')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Filtered Files',
        type: FilesDto,
    })
    async filteredFiles(
        @Query()
        query: PaginatedQueryDto &
            SortParams &
            DateRangeParams &
            AndOrParam &
            FileTypeParam &
            FilteredParams,
        @AddUser() auth: AuthHeader,
    ): Promise<FilesDto> {
        const tags = {}; // TODO allow for querying by tags

        return await this.fileService.findFiltered(
            query.fileName,
            query.projectUUID,
            query.missionUUID,
            query.startDate,
            query.endDate,
            '', // query.topics,
            query.andOr,
            query.fileTypes,
            tags, // todo check if this is correct
            auth.user.uuid,
            query.take,
            query.skip,
            query.sort,
            query.sortDirection,
        );
    }

    @Get('download')
    @CanReadFile()
    @OutputDto(null) // TODO: type API response
    async download(@Query() { uuid, expires }: DownloadParams) {
        logger.debug(`download ${uuid}: expires=${expires.toString()}`);
        return this.fileService.generateDownload(uuid, expires);
    }

    @Get('one')
    @CanReadFile()
    @ApiOkResponse({
        description: 'File',
        type: FileWithTopicDto,
    })
    async getFileById(
        @Query() { uuid }: OnlyUuidParams,
    ): Promise<FileWithTopicDto> {
        return this.fileService.findOne(uuid);
    }

    @Get('ofMission')
    @CanReadMission()
    @ApiOkResponse({
        description: 'Files of a Mission',
        type: FilesDto,
    })
    async getFilesOfMission(
        @Query()
        query: PaginatedQueryDto & OfMissionFileDto & SortParams & HealthParam,
    ): Promise<FilesDto> {
        return this.fileService.findByMission(
            query.uuid,
            query.take,
            query.skip,
            query.filename,
            query.filetype,
            query.categories,
            query.sort,
            query.sortDirection,
            query.health,
        );
    }

    @Put(':uuid')
    @CanWriteFile()
    @OutputDto(null) // TODO: type API response
    async update(@Query() query: OnlyUuidParams, @Body() dto: UpdateFile) {
        return this.fileService.update(query.uuid, dto);
    }

    @Post('moveFiles')
    @CanMoveFiles()
    @OutputDto(null) // TODO: type API response
    async moveFiles(
        @BodyUUIDArray('fileUUIDs', 'List of File UUID to be moved')
        fileUUIDs: string[],
        @BodyUUID('missionUUID', 'UUID of target Mission') missionUUID: string,
    ) {
        return this.fileService.moveFiles(fileUUIDs, missionUUID);
    }

    @Get('oneByName')
    @CanReadMission()
    @OutputDto(null) // TODO: type API response
    async getOneFileByName(@Query() query: OneByNameFileDto) {
        return this.fileService.findOneByName(query.uuid, query.filename);
    }

    @Delete(':uuid')
    @CanDeleteFile()
    @OutputDto(null) // TODO: type API response
    async deleteFile(@Query() query: OnlyUuidParams): Promise<void> {
        await this.fileService.deleteFile(query.uuid);
    }

    @Get('storage')
    @ApiOkResponse({
        description: 'Storage information',
        type: StorageOverviewDto,
    })
    @LoggedIn()
    async getStorage(): Promise<StorageOverviewDto> {
        return this.fileService.getStorage();
    }

    @Get('isUploading')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Indicates if the current API user is uplaoding any files',
        type: IsUploadingDto,
    })
    async isUploading(
        @Query() _query: NoQueryParametersDto,
        @AddUser() auth: AuthHeader,
    ): Promise<IsUploadingDto> {
        return {
            isUploading: await this.fileService.isUploading(auth.user.uuid),
        };
    }

    @Post('temporaryAccess')
    @CanCreateInMissionByBody()
    @OutputDto(null) // TODO: type API response
    async getTemporaryAccess(
        @AddUser() auth: AuthHeader,
        @Body() body: CreatePreSignedURLSDto,
    ): Promise<TemporaryFileAccessesDto> {
        return await this.fileService.getTemporaryAccess(
            body.filenames,
            body.missionUUID,
            auth.user.uuid,
        );
    }

    @Post('cancelUpload')
    @UserOnly() //Push back authentication to the queue to accelerate the request
    // TODO: type API response
    async cancelUpload(
        @BodyUUIDArray(
            'uuids',
            "File UUIDs who, if they aren't 'OK', are deleted",
        )
        uuids: string[],
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @AddUser() auth: AuthHeader,
    ) {
        logger.debug(`cancelUpload ${uuids.toString()}`);
        return this.fileService.cancelUpload(
            uuids,
            missionUUID,
            auth.user.uuid,
        );
    }

    @Post('deleteMultiple')
    @CanDeleteMission()
    @OutputDto(null) // TODO: type API response
    async deleteMultiple(
        @BodyUUIDArray('uuids', 'List of File UUID to be deleted')
        uuids: string[],
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
    ): Promise<void> {
        return this.fileService.deleteMultiple(uuids, missionUUID);
    }

    @Get('exists')
    @CanReadFile()
    @ApiOkResponse({
        description: 'File exists',
        type: FileExistsResponseDto,
    })
    async exists(@Query() query: ExistsParams): Promise<FileExistsResponseDto> {
        return this.fileService.exists(query.uuid);
    }

    @Post('resetMinioTags')
    @AdminOnly()
    @ApiOkResponse({
        description: 'Resetting Minio tags completed',
    })
    async resetMinioTags() {
        logger.debug('Resetting Minio tags');
        await this.fileService.renameTags(env.MINIO_BAG_BUCKET_NAME);
        await this.fileService.renameTags(env.MINIO_MCAP_BUCKET_NAME);
        logger.debug('Resetting Minio tags done');
    }

    @Post('recomputeFileSizes')
    @AdminOnly()
    @ApiOkResponse({
        description: 'Recomputing file sizes completed',
    })
    async recomputeFileSizes() {
        logger.debug('Recomputing file sizes');
        await this.fileService.recomputeFileSizes();
        logger.debug('Recomputing file sizes done');
    }
}
