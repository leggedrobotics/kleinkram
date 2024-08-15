import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { IsValidMissionName } from '../../validation/propertyDecorator';

export class CreateMission {
    @IsString()
    @IsNotEmpty()
    @IsValidMissionName()
    name: string;

    @IsUUID()
    projectUUID: string;

    @IsNotEmpty()
    tags: Record<string, string>;
}
