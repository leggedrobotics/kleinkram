import { IsUUID } from 'class-validator';
import { CreateTemplateDto } from '../../../api/types/actions/create-template.dto';

export class UpdateTemplateDto extends CreateTemplateDto {
    @IsUUID()
    uuid!: string;
}
