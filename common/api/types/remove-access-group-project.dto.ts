import { ApiUUIDProperty } from '../../../backend/src/validation/body-decorators';

export class RemoveAccessGroupFromProjectDto {
    @ApiUUIDProperty('Project UUID')
    uuid!: string;

    @ApiUUIDProperty('Access Group UUID')
    accessGroupUUID!: string;
}
