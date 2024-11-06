import { ApiUUIDProperty } from '../../validation/bodyDecorators';


export class RemoveAccessGroupFromProject {
    @ApiUUIDProperty('Project UUID')
    uuid: string;

    @ApiUUIDProperty('Access Group UUID')
    accessGroupUUID: string;

}