import axios from 'src/api/axios';

export const createAnalysis = async (
    docker_image: string,
    missionUUID: string,
) => {
    const response = await axios.post('/action/submit', {
        missionUUID,
        docker_image,
    });
    return response.data;
};
