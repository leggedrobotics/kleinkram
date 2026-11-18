import { TemplateFieldsDto } from '@api-dto/actions/create-template.dto';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateTemplateDto extends TemplateFieldsDto {
    @IsUUID()
    uuid!: string;

    /**
     * The name of the template the new version belongs to. It must be the
     * current name (checked by `TemplateService.createVersion`), so templates
     * created before the naming rules keep their name.
     */
    @IsString()
    @IsNotEmpty()
    name!: string;
}
