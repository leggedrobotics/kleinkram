import axios from 'src/api/axios';
import { Mission } from 'src/types/Mission';

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

export const deleteMission = async (mission: Mission) => {
    const response = await axios.delete('/mission', {
        data: { uuid: mission.uuid },
    });
    return response.data;
};

export const updateMissionTags = async (
    missionUUID: string,
    tags: Record<string, string>,
) => {
    const response = await axios.post('/mission/tags', { missionUUID, tags });
    return response.data;
};
