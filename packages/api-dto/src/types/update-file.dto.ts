import { IsNoValidUUID } from '@kleinkram/validation';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateFile {
    @IsUUID() uuid!: string;

    /**
     * Checked against the file naming rules by the server only if it changes,
     * so a file named before the rules can still be edited without renaming it.
     */
    @IsNoValidUUID() @IsString() filename!: string;

    @IsOptional() @IsUUID() missionUuid?: string;
    @IsDate() @Type(() => Date) date!: Date;
    @IsOptional() @IsUUID('all', { each: true }) categories!: string[];
}
