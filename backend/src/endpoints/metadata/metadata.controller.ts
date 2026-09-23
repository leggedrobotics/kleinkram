import { ApiOkResponse } from '@/decorators';
import { MetadataService } from '@/services/metadata.service';
import { DeleteMetadataDto } from '@kleinkram/api-dto';
import { Controller, Delete } from '@nestjs/common';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import { CanDeleteMetadata } from '../auth/roles.decorator';

@Controller('metadata')
export class MetadataController {
    constructor(private readonly metadataService: MetadataService) {}

    @Delete(':uuid')
    @CanDeleteMetadata()
    @ApiOkResponse({
        type: DeleteMetadataDto,
    })
    async deleteMetadata(
        @ParameterUID('uuid') uuid: string,
    ): Promise<DeleteMetadataDto> {
        return this.metadataService.deleteMetadata(uuid);
    }
}
