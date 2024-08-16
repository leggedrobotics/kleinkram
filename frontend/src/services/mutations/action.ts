import axios from 'src/api/axios';

export const createAnalysis = async (action: {
    action_name: string;
    mission_uuid: string;
    gpu_model: string;
    docker_image: string;
}) => {
    const response = await axios.post('/action/submit', {
        action_name: action.action_name,
        missionUUID: action.mission_uuid,
        gpu_model: action.gpu_model,
        docker_image: action.docker_image,
    });
    return response.data;
};
