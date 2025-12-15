import { CreateTemplateDto } from '@api-dto/actions/create-template.dto';
import { IsUUID } from 'class-validator';

export class UpdateTemplateDto extends CreateTemplateDto {
    @IsUUID()
    uuid!: string;
}
