import { FileDto } from '@api-dto/file/file.dto';
import { MissionWithCreatorDto } from '@api-dto/mission/mission.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export class MissionWithFilesDto extends MissionWithCreatorDto {
    @ApiProperty({
        type: () => FileDto,
        description: 'List of files',
    })
    @ValidateNested()
    @Type(() => FileDto)
    files!: FileDto[];
}
