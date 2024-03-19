import axios from 'src/api/axios';
import { Project, Run, Topic } from 'src/types/types';

export const fetchOverview = async (): Promise<Run[]> => {
  try {
    const response = await axios.get('/run/all');
    console.log('In',response.data)
    const res = response.data.map((run: any) => {
      const project = new Project(
        run.project.uuid,
        run.project.name,
        [],
        new Date(run.project.createdAt),
        new Date(run.project.updatedAt),
        new Date(run.project.deletedAt)
      );
      return new Run(
        run.uuid,
        run.name,
        [],
        project,
        new Date(run.date),
        new Date(run.createdAt),
        new Date(run.updatedAt),
        new Date(run.deletedAt));
    });
    console.log('Out',res)
    return res;
  } catch (error) {
    console.error('Error fetching overview:', error);
    throw error; // Rethrow or handle as appropriate
  }
}

export const allProjects = async () => {
  const response = await axios.get('/project');
  return response.data;
}

export const fetchRun = async (uuid: string): Promise<Run> => {
  try {
    const response = await axios.get(`/run/${uuid}`);
    const run = response.data;
    const project = new Project(
      run.project.uuid,
      run.project.name,
      [],
      new Date(run.project.createdAt),
      new Date(run.project.updatedAt),
      new Date(run.project.deletedAt)
    );
    return new Run(
      run.uuid,
      run.name,
      [],
      project,
      new Date(run.date),
      new Date(run.createdAt),
      new Date(run.updatedAt),
      new Date(run.deletedAt));
  }
  catch (error) {
    console.error('Error fetching run:', error);
    throw error; // Rethrow or handle as appropriate
  }
}

export const allTopics = async () => {
  const response = await axios.get('/topic/all');
  return response.data
}
