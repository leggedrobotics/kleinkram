import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Put,
    Query,
    Param,
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
import { FileType } from '@common/frontend_shared/enum';
import { BodyUUID, BodyUUIDArray } from '../../validation/body-decorators';
import env from '@common/environment';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { StorageOverviewDto } from '@common/api/types/storage-overview.dto';
import { NoQueryParametersDto } from '@common/api/types/no-query-parameters.dto';
import { IsUploadingDto } from '@common/api/types/file/is-uploading.dto';
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

    @Post('') // create file
    async getTemporaryAccess(
        @AddUser() auth: AuthHeader,
        @Body() body: CreatePreSignedURLSDto,
    ): Promise<TemporaryFileAccessesDto> {
        throw new Error('Not implemented');
    }

    @Get(':uuid')
    async getFileById(@Param('uuid') uuid: string): Promise<FileWithTopicDto> {
        throw new Error('Not implemented');
    }

    @Put(':uuid')
    async update(@Param('uuid') uuid: string, @Body() dto: UpdateFile) {
        throw new Error('Not implemented');
    }

    @Delete(':uuid')
    async deleteFile(@Param('uuid') uuid: string): Promise<void> {
        throw new Error('Not implemented');
    }

    @Get('')
    async getFiles(@Query() query: FileQueryDto, @AddUser() auth: AuthHeader) {
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

    @Delete('')
    async deleteMultiple(): Promise<void> {
        throw new Error('Not implemented');
    }

    @Post(':uuid/download')
    async download(@Param('uuid') uuid: string) {
        throw new Error('Not implemented');
    }

    @Get('uploads')
    async isUploading(): Promise<IsUploadingDto> {
        throw new Error('Not implemented');
    }

    @Delete('uploads/:uuid')
    async cancelUpload(@Param('uuid') uuid: string): Promise<void> {
        throw new Error('Not implemented');
    }

    @Get('storage')
    @LoggedIn()
    async getStorage(): Promise<StorageOverviewDto> {
        return this.fileService.getStorage();
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
