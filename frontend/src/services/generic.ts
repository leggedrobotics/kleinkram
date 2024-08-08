import { DataType } from 'src/enums/TAG_TYPES';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { ProjectAccess } from 'src/types/ProjectAccess';

export const icon = (type: DataType) => {
    switch (type) {
        case DataType.BOOLEAN:
            return 'sym_o_check_box';
        case DataType.NUMBER:
            return 'sym_o_looks_one';
        case DataType.STRING:
            return 'sym_o_text_fields';
        case DataType.DATE:
            return 'sym_o_event';
        case DataType.LOCATION:
            return 'sym_o_location_on';
        case DataType.LINK:
            return 'sym_o_link';
        case DataType.ANY:
            return 'sym_o_help';
    }
};

export const accessGroupRightsMap = {
    [AccessGroupRights.NONE]: 'None',
    [AccessGroupRights.READ]: 'Read',
    [AccessGroupRights.CREATE]: 'Create',
    [AccessGroupRights.WRITE]: 'Write',
    [AccessGroupRights.DELETE]: 'Delete',
};

export function getAccessRightDescription(value: AccessGroupRights): string {
    return accessGroupRightsMap[value] || 'Unknown';
}

export const AccessRightsColumns = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: (row: ProjectAccess) => row.accessGroup.name,
        sortable: true,
    },
    {
        name: 'rights',
        required: true,
        label: 'Rights',
        align: 'left',
        field: (row: ProjectAccess) =>
            `${getAccessRightDescription(row.rights)} (${row.rights})`,
        sortable: true,
    },
];
