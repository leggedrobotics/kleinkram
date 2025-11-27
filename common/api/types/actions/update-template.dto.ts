import { CreateTemplateDto } from '@common/api/types/actions/create-template.dto';
import { IsUUID } from 'class-validator';

export class UpdateTemplateDto extends CreateTemplateDto {
    @IsUUID()
    uuid!: string;
}
