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
    CanReadFileByName,
    CanReadMission,
    CanWriteFile,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';
import {
    QueryBoolean,
    QueryOptionalDate,
    QueryOptionalRecord,
    QueryOptionalString,
    QueryOptionalStringArray,
    QueryOptionalUUID,
    QuerySkip,
    QuerySortBy,
    QuerySortDirection,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../../validation/queryDecorators';
import { ParamUUID as ParameterUID } from '../../validation/paramDecorators';
import { FileType } from '@common/frontend_shared/enum';
import { BodyUUID, BodyUUIDArray } from '../../validation/bodyDecorators';
import env from '@common/env';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { StorageOverviewDto } from '@common/api/types/storage-overview.dto';
import { NoQueryParamsDto } from '@common/api/types/no-query-params.dto';
import { IsUploadingDto } from '@common/api/types/files/is-uploading.dto';
import { FilesDto } from '@common/api/types/files/files.dto';
import { FileWithTopicDto } from '@common/api/types/files/file.dto';
import { PaggedResponse } from '@common/api/types/pagged-response';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsBoolean,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsSkip } from '@common/validation/skip-validation';
import { IsTake } from '@common/validation/take-validation';
import { AddUser, AuthRes } from '../auth/param-decorator';
import { CreatePreSignedURLSDto } from '@common/api/types/create-pre-signed-url.dto';

export class AccessCredentialsDto {
    @ApiProperty()
    @IsString()
    accessKey!: string;

    @ApiProperty()
    @IsString()
    secretKey!: string;

    @ApiProperty()
    @IsString()
    sessionToken!: string;
}

export class TemporaryFileAccessDto {
    @ApiProperty()
    @IsString()
    bucket!: string;

    @ApiProperty()
    @IsUUID()
    fileUUID!: string;

    @ApiProperty()
    @IsString()
    fileName!: string;

    @ApiProperty()
    @ValidateNested()
    @Type(() => AccessCredentialsDto)
    accessCredentials!: AccessCredentialsDto;

    @ApiProperty()
    @IsString()
    queueUUID!: string;
}

export class TemporaryFileAccessesDto
    implements PaggedResponse<TemporaryFileAccessDto>
{
    @ApiProperty()
    @ValidateNested({ each: true })
    @Type(() => TemporaryFileAccessDto)
    data!: TemporaryFileAccessDto[];

    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}

export class FileExistsResponseDto {
    @ApiProperty()
    @IsBoolean()
    exists!: boolean;

    @ApiProperty()
    @IsUUID()
    uuid!: string;
}

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Get('all')
    @UserOnly()
    async allFiles(
        @AddUser() auth: AuthRes,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return await this.fileService.findAll(auth.user.uuid, take, skip);
    }

    @Get('filteredByNames')
    @UserOnly()
    async filteredByNames(
        @QueryOptionalString(
            'projectName',
            'Name of a Project (or part there of)',
        )
        projectName: string,
        @QueryOptionalString(
            'missionName',
            'Name of a Mission (or part there of)',
        )
        missionName: string,
        @QueryOptionalString('topics', 'Name of Topics (coma separated)')
        topics: string,
        @QueryOptionalRecord('tags', 'Dictionary Tagtype name to Tag value')
        tags: Record<string, any>,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @AddUser() auth: AuthRes,
    ) {
        return await this.fileService.findFilteredByNames(
            projectName,
            missionName,
            topics,
            auth.user.uuid,
            take,
            skip,
            tags,
        );
    }

    @Get('filtered')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Filtered Files',
        type: FilesDto,
    })
    async filteredFiles(
        @QueryOptionalString('fileName', 'Filter for Filename')
        fileName: string,
        @QueryOptionalUUID('projectUUID', 'UUID of Project to filter by')
        projectUUID: string,
        @QueryOptionalUUID('missionUUID', 'UUID of Mission to filter by')
        missionUUID: string,
        @QueryOptionalDate(
            'startDate',
            'Date specifying the start of the filtered time range',
        )
        startDate: Date | undefined,
        @QueryOptionalDate(
            'endDate',
            'Date specifying the end of the filtered time range',
        )
        endDate: Date | undefined,
        @QueryOptionalString('topics', 'Name of Topics (coma separated)')
        topics: string,
        @QueryOptionalString(
            'fileTypes',
            "Filetypes: 'bag' | 'mcap' | 'bag,mcap' ",
        )
        fileTypes: string,
        @QueryBoolean(
            'andOr',
            'Returned File needs all specified topics (true) or any specified topics (false)',
        )
        andOr: boolean,
        @QueryOptionalRecord('tags', 'Dictionary Tagtype name to Tag value')
        tags: Record<string, any>,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QuerySortBy('sort') sort: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @AddUser() auth: AuthRes,
    ): Promise<FilesDto> {
        let _missionUUID = missionUUID;
        if (auth.apikey) {
            _missionUUID = auth.apikey.mission.uuid;
        }
        return await this.fileService.findFiltered(
            fileName,
            projectUUID,
            _missionUUID,
            startDate,
            endDate,
            topics,
            andOr,
            fileTypes,
            tags, // todo check if this is correct
            auth.user.uuid,
            Number.parseInt(String(take)), // TODO: fix
            Number.parseInt(String(skip)), // TODO: fix
            sort,
            sortDirection,
        );
    }

    @Get('download')
    @CanReadFile()
    async download(
        @QueryUUID('uuid', 'File UUID') uuid: string,
        @QueryBoolean(
            'expires',
            'Whether the download link should stay valid for on week (false) or 4h (true)',
        )
        expires: boolean,
    ) {
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
        @QueryUUID('uuid', 'File UUID') uuid: string,
    ): Promise<FileWithTopicDto> {
        return this.fileService.findOne(uuid);
    }

    @Get('byName')
    @CanReadFileByName()
    async getFileByName(@QueryString('name', 'Filename') name: string) {
        return this.fileService.findByFilename(name);
    }

    @Get('ofMission')
    @CanReadMission()
    @ApiOkResponse({
        description: 'Files of a Mission',
        type: FilesDto,
    })
    async getFilesOfMission(
        @QueryUUID('uuid', 'File UUID') uuid: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QueryOptionalString('filename', 'Filename filter') filename: string,
        @QueryOptionalString('fileType', 'Filetype filter') fileType: string,
        @QueryOptionalStringArray(
            'categories',
            'Categories to filter by (logical OR)',
        )
        categories: string[],
        @QuerySortBy('sort') sort: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QueryOptionalString('health', 'File health') health: string,
    ): Promise<FilesDto> {
        return this.fileService.findByMission(
            uuid,
            Number.parseInt(String(take)), // TODO: fix
            Number.parseInt(String(skip)), // TODO: fix
            filename,
            // TODO: fix the following, it's ugly
            fileType === '' ? FileType.ALL : (fileType as FileType),
            categories,
            sort,
            sortDirection,
            health,
        );
    }

    @Put(':uuid')
    @CanWriteFile()
    async update(@ParameterUID('uuid') uuid: string, @Body() dto: UpdateFile) {
        return this.fileService.update(uuid, dto);
    }

    @Post('moveFiles')
    @CanMoveFiles()
    async moveFiles(
        @BodyUUIDArray('fileUUIDs', 'List of File UUID to be moved')
        fileUUIDs: string[],
        @BodyUUID('missionUUID', 'UUID of target Mission') missionUUID: string,
    ) {
        return this.fileService.moveFiles(fileUUIDs, missionUUID);
    }

    @Get('oneByName')
    @CanReadMission()
    async getOneFileByName(
        @QueryUUID('uuid', 'Mission UUID to search in') uuid: string,
        @QueryString('filename', 'Filename searched for') name: string,
    ) {
        return this.fileService.findOneByName(uuid, name);
    }

    @Delete(':uuid')
    @CanDeleteFile()
    @OutputDto(null)
    async deleteFile(@ParameterUID('uuid') uuid: string): Promise<void> {
        await this.fileService.deleteFile(uuid);
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
        @Query() _query: NoQueryParamsDto,
        @AddUser() auth: AuthRes,
    ): Promise<IsUploadingDto> {
        return {
            isUploading: await this.fileService.isUploading(auth.user.uuid),
        };
    }

    @Post('temporaryAccess')
    @CanCreateInMissionByBody()
    @ApiOkResponse({
        description: 'Temporary access granted',
        type: TemporaryFileAccessesDto,
    })
    async getTemporaryAccess(
        @AddUser() auth: AuthRes,
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
    async cancelUpload(
        @BodyUUIDArray(
            'uuids',
            "File UUIDs who, if they aren't 'OK', are deleted",
        )
        uuids: string[],
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @AddUser() auth: AuthRes,
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
    @OutputDto(null)
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
    async exists(
        @QueryUUID('uuid', 'FileUUID searched') uuid: string,
    ): Promise<FileExistsResponseDto> {
        return this.fileService.exists(uuid);
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
