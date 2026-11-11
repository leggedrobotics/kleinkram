import { TemplateFieldsDto } from '@api-dto/actions/create-template.dto';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateTemplateDto extends TemplateFieldsDto {
    @IsUUID()
    uuid!: string;

    /**
     * The name of the template the new version belongs to. Templates created
     * before the naming rules may keep their name; a name that does not exist
     * yet is checked against the rules by `TemplateService.createVersion`.
     */
    @IsString()
    @IsNotEmpty()
    name!: string;
}
