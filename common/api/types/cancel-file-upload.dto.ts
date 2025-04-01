import { IsArray, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelFileUploadDto {
    @ApiProperty()
    @IsArray()
    @IsString({ each: true })
    uuids!: string[];

    @IsUUID()
    missionUuid!: string;
}
