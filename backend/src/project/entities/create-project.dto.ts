import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProject {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsArray()
    requiredTags: string[];
}
