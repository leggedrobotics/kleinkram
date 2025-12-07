import { IsBoolean } from 'class-validator';

export class DriveImportResponseDto {
    @IsBoolean()
    success!: boolean;
}
