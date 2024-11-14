import { ApiUUIDProperty } from '../../validation/bodyDecorators';

export class RemoveAccessGroupFromProjectDto {
    @ApiUUIDProperty('Project UUID')
    uuid: string;

    @ApiUUIDProperty('Access Group UUID')
    accessGroupUUID: string;
}
