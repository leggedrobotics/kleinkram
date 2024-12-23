import { ApiProperty } from '@nestjs/swagger';
import { FileLocation, QueueState } from '../../frontend_shared/enum';
import { UserDto } from './user.dto';
import {
    IsDate,
    IsEnum,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaggedResponse } from './pagged-response';
import { IsSkip } from '../../validation/skip-validation';
import { IsTake } from '../../validation/take-validation';
import { MissionDto } from './mission.dto';

export class FileQueueEntryDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty()
    @IsString()
    identifier!: string;

    @ApiProperty()
    @IsString()
    displayName!: string;

    @ApiProperty()
    @IsEnum(FileLocation)
    location!: FileLocation;

    @ApiProperty()
    @IsNumber()
    processingDuration!: number;

    @ApiProperty()
    @ValidateNested()
    @Type(() => UserDto)
    creator!: UserDto;

    @ApiProperty()
    @IsEnum(QueueState)
    state!: QueueState;

    @ApiProperty()
    @IsString()
    filename!: string;

    @ApiProperty()
    @ValidateNested()
    @Type(() => MissionDto)
    mission!: MissionDto;
}

export class FileQueueEntriesDto implements PaggedResponse<FileQueueEntryDto> {
    @ApiProperty()
    @ValidateNested()
    @Type(() => FileQueueEntryDto)
    data!: FileQueueEntryDto[];

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
