import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProject {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    requiredTags: string[];
}
