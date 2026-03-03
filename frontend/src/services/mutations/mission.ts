import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const moveMissions = async (
    missionUUIDs: string[],
    targetProjectUUID: string,
    newName?: string,
) => {
    const response = await axios.post('/mission/move', {
        missionUUIDs,
        targetProjectUUID,
        newName,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const deleteMission = async (mission: MissionWithFilesDto) => {
    const response = await axios.delete(`/mission/${mission.uuid}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const updateMissionTags = async (
    missionUUID: string,
    tags: Record<string, string>,
) => {
    const response = await axios.post('/mission/tags', { missionUUID, tags });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const updateMissionName = async (missionUUID: string, name: string) => {
    const response = await axios.post('/mission/updateName', {
        missionUUID,
        name,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};
