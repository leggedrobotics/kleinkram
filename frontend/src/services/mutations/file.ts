import { FileEntity } from 'src/types/FileEntity';
import axios from 'src/api/axios';

export const updateFile = async ({ file }: { file: FileEntity }) => {
    const response = await axios.put(`/file/${file.uuid}`, file);
    return response.data;
};
