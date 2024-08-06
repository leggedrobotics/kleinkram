import axios from 'src/api/axios';

export const createMission = async (
    name: string,
    projectUUID: string,
    tags: Record<string, string>,
) => {
    const response = await axios.post('/mission/create', {
        name,
        projectUUID,
        tags,
    });
    return response.data;
};

export const moveMission = async (missionUUID: string, projectUUID: string) => {
    const response = await axios.post(
        '/mission/move',
        {},
        { params: { missionUUID, projectUUID } },
    );
    return response.data;
};
