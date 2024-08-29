import { FileEntity } from 'src/types/FileEntity';
import axios from 'src/api/axios';
import { Credentials } from 'minio';

export const updateFile = async ({ file }: { file: FileEntity }) => {
    const response = await axios.put(`/file/${file.uuid}`, {
        uuid: file.uuid,
        filename: file.filename,
        mission_uuid: file.mission?.uuid,
        project_uuid: file.mission?.project?.uuid,
        date: file.date,
    });
    return response.data;
};

export const deleteFile = async (file: FileEntity) => {
    const response = await axios.delete(`/file`, { data: { uuid: file.uuid } });
    return response.data;
};

export const generateTemporaryCredentials = async (
    filenames: Record<string, Record<string, string>>,
    missionUUID,
): { credentials: Credentials; files: string[] } => {
    const response = await axios.post('/file/temporaryAccess', {
        filenames,
        missionUUID,
    });
    console.log('generateTemporaryCredentials', response.data);
    return response.data;
};
