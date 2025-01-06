import axios from 'src/api/axios';
import { MissionWithFilesDto } from '@api/types/mission.dto';

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

export const deleteMission = async (mission: MissionWithFilesDto) => {
    const response = await axios.delete(`/mission/${mission.uuid}`);
    return response.data;
};

export const updateMissionTags = async (
    missionUUID: string,
    tags: Record<string, string>,
) => {
    const response = await axios.post('/mission/tags', { missionUUID, tags });
    return response.data;
};

export const updateMissionName = async (missionUUID: string, name: string) => {
    const response = await axios.post('/mission/updateName', {
        missionUUID,
        name,
    });
    return response.data;
};
