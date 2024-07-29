import {FileEntity} from 'src/types/FileEntity';
import axios from 'src/api/axios';

export const updateFile = async ({file}: { file: FileEntity }) => {
    const response = await axios.put(`/file/${file.uuid}`, {
        uuid: file.uuid,
        filename: file.filename,
        mission_uuid: file.mission?.uuid,
        project_uuid: file.mission?.project?.uuid,
        date: file.date,
    });
    return response.data;
};
