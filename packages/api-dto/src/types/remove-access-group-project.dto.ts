import { ApiUUIDProperty } from '@kleinkram/validation';

export class RemoveAccessGroupFromProjectDto {
    @ApiUUIDProperty('Project UUID')
    uuid!: string;

    @ApiUUIDProperty('Access Group UUID')
    accessGroupUUID!: string;
}
