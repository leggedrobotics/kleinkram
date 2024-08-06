import axios from 'src/api/axios';
import { AccessGroup } from 'src/types/AccessGroup';

export const canAddAccessGroup = async (
    project_uuid: string,
): Promise<boolean> => {
    if (!project_uuid) {
        return false;
    }
    const response = await axios.get('/access/canAddAccessGroupToProject', {
        params: { uuid: project_uuid },
    });

    return response.data;
};

export const searchAccessGroups = async (
    search: string,
): Promise<AccessGroup[]> => {
    const response = await axios.get('/access/searchAccessGroup', {
        params: { search },
    });
    return response.data.map((group: any) => {
        return new AccessGroup(
            group.uuid,
            group.name,
            [],
            [],
            [],
            group.personal,
            group.inheriting,
            new Date(group.createdAt),
            new Date(group.updatedAt),
            new Date(group.deletedAt),
        );
    });
};
