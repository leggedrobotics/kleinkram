import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import axios from 'src/api/axios';

export const createMission = async (
    name: string,
    projectUUID: string,
    tags: Record<string, string>,
) => {
    const response = await axios.post('/missions', {
        name,
        projectUUID,
        tags,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const moveMission = async (missionUUID: string, projectUUID: string) => {
    const response = await axios.post(
        `/missions/${missionUUID}/move`,
        {},
        { params: { projectUUID } },
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const deleteMission = async (mission: MissionWithFilesDto) => {
    const response = await axios.delete(`/missions/${mission.uuid}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const updateMissionTags = async (
    missionUUID: string,
    tags: Record<string, string>,
) => {
    const response = await axios.post(`/missions/${missionUUID}/metadata`, {
        metadata: tags,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const updateMissionName = async (missionUUID: string, name: string) => {
    const response = await axios.patch(`/missions/${missionUUID}/name`, {
        name,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};
