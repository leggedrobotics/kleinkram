import axios from 'src/api/axios';
import { Run } from 'src/types/types';

export const createProject = async (name: string) => {
  const response = await axios.post('/project/create', { name });
  return response.data;
}

export const createRun = async (name: string, projectUUID: string, date: Date, file: File) => {
  const formData = new FormData();
  console.log(date)
  formData.append('name', name);
  formData.append('projectUUID', projectUUID);
  formData.append('date', date.toISOString());
  formData.append('file', file);


  const response = await axios.post('/run/create', formData, {
    headers: {
    },
  });

  return response.data;
}

export const updateRun = async(run: Run) => {
  const response = await axios.put(`/run/${run.uuid}`, run);
  return response.data;
}
