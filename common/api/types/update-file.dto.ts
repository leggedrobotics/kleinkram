import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';
import {
    IsNoValidUUID,
    IsValidFileName,
} from '../../../backend/src/validation/property-decorator';

export class UpdateFile {
    @IsUUID() uuid!: string;

    @IsNoValidUUID() @IsValidFileName() @IsString() filename!: string;

    @IsOptional() @IsUUID() missionUuid?: string;
    @IsDate() @Type(() => Date) date!: Date;
    @IsOptional() @IsUUID('all', { each: true }) categories!: string[];
}
