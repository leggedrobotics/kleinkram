import axios from 'src/api/axios';
import { Run } from 'src/types/types';

export const createProject = async (name: string) => {
  const response = await axios.post('/project/create', { name });
  return response.data;
}

export const createRun = async (name: string, projectUUID: string, file: File): Promise<Run> => {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('projectUUID', projectUUID);
  formData.append('file', file);


  const response = await axios.post('/run/create', formData, {
    headers: {
    },
  });

  return response.data;
}

export const createDrive = async (name: string, projectUUID: string, driveURL: string) => {
  const response = await axios.post('/run/createdrive', { name, projectUUID, driveURL });
  return response.data;
}

export const updateRun = async(run: Run) => {
  const response = await axios.put(`/run/${run.uuid}`, run);
  return response.data;
}
