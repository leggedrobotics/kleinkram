import { ApiOkResponse } from '@/decorators';
import { MetadataService } from '@/services/metadata.service';
import { DeleteTagDto } from '@kleinkram/api-dto';
import { Controller, Delete } from '@nestjs/common';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import { CanDeleteTag } from '../auth/roles.decorator';

@Controller('metadata')
export class MetadataController {
    constructor(private readonly metadataService: MetadataService) {}

    @Delete(':uuid')
    @CanDeleteTag()
    @ApiOkResponse({
        type: DeleteTagDto,
    })
    async deleteTag(@ParameterUID('uuid') uuid: string): Promise<DeleteTagDto> {
        return this.metadataService.deleteTag(uuid);
    }
}
