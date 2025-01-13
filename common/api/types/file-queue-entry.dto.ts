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
import { Paginated } from './pagination';
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
    display_name!: string;

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
    @ValidateNested()
    @Type(() => MissionDto)
    mission!: MissionDto;
}

export class FileQueueEntriesDto implements Paginated<FileQueueEntryDto> {
    @ApiProperty({
        type: [FileQueueEntryDto],
        description: 'List of file queue entries',
    })
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
