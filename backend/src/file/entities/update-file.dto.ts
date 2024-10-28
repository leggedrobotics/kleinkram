import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsValidFileName } from '../../validation/propertyDecorator';

export class UpdateFile {
    @IsUUID() uuid: string;
    @IsValidFileName() @IsString() filename: string;
    @IsOptional() @IsUUID() mission_uuid?: string;
    @IsDate() date: Date;
    @IsOptional() @IsUUID('all', { each: true }) categories: string[];
}
