import axios from 'src/api/axios';
import {FileEntity} from 'src/types/types';

export const createProject = async (name: string, description: string) => {
  const response = await axios.post('/project/create', {name, description});
  return response.data;
}

export const createRun = async (name: string, projectUUID: string) => {
  const response = await axios.post('/run/create', {name, projectUUID});
  return response.data;

}

export const createAnalysis = async (docker_image: string, runUUID: string) => {
  const response = await axios.post('/analysis/submit', {runUUID, docker_image});
  return response.data;

}

export const getUploadURL = async (filenames: string[]) => {
  const response = await axios.post('/queue/createPreSignedURLS', {filenames});
  return response.data;
}

export const confirmUpload = async (filename: string) => {
  const response = await axios.post('/queue/confirmUpload', {filename});
  return response.data;

}

export const createFile = async (name: string, runUUID: string, file: File): Promise<FileEntity> => {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('runUUID', runUUID);
  formData.append('file', file);


  const response = await axios.post('/queue/create', formData, {
    headers: {},
  });

  return response.data;
}

export const createDrive = async (projectUUID: string, driveURL: string) => {
  const response = await axios.post('/queue/createdrive', {projectUUID, driveURL});
  return response.data;
}

export const updateFile = async (file: FileEntity) => {
  const response = await axios.put(`/file/${file.uuid}`, file);
  return response.data;
}
