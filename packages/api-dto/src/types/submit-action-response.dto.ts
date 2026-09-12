import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SubmitActionDto {
    @IsUUID()
    @ApiProperty()
    missionUUID!: string;

    @IsUUID()
    @ApiProperty()
    templateUUID!: string;

    @IsOptional()
    @IsUUID()
    @ApiProperty({ required: false })
    fileUUID?: string;
}

export class ActionSubmitResponseDto {
    @ApiProperty()
    @IsUUID()
    actionUUID!: string;
}
