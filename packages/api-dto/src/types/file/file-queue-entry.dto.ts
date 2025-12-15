import { MissionDto } from '@api-dto/mission/mission.dto';
import { Paginated } from '@api-dto/pagination';
import { UserDto } from '@api-dto/user/user.dto';
import { FileLocation, QueueState } from '@kleinkram/shared';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

@Expose()
export class FileQueueEntryDto {
    @ApiProperty()
    @IsUUID()
    @Expose()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    @Expose()
    updatedAt!: Date;

    @ApiProperty()
    @IsString()
    @Expose()
    identifier!: string;

    @ApiProperty()
    @IsString()
    @Expose()
    displayName!: string;

    @ApiProperty()
    @IsEnum(FileLocation)
    @Expose()
    location!: FileLocation;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    @Expose()
    processingDuration!: number | null;

    @ApiProperty()
    @ValidateNested()
    @Type(() => UserDto)
    @Expose()
    creator!: UserDto;

    @ApiProperty()
    @IsEnum(QueueState)
    @Expose()
    state!: QueueState;

    @ApiProperty()
    @IsString()
    @IsOptional()
    @Expose()
    errorMessage?: string;

    @ApiProperty()
    @ValidateNested()
    @Type(() => MissionDto)
    @Expose()
    mission!: MissionDto;
}

@Expose()
export class FileQueueEntriesDto implements Paginated<FileQueueEntryDto> {
    @ApiProperty()
    @IsNumber()
    @Expose()
    count!: number;

    @ApiProperty({
        description: 'List of queued files',
        type: () => [FileQueueEntryDto],
    })
    @ValidateNested()
    @Type(() => FileQueueEntryDto)
    @Expose()
    data!: FileQueueEntryDto[];

    @ApiProperty()
    @IsSkip()
    @Expose()
    skip!: number;

    @ApiProperty()
    @IsTake()
    @Expose()
    take!: number;
}
