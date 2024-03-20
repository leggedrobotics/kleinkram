import axios from 'src/api/axios';
import { Project, Run, Topic } from 'src/types/types';

export const fetchOverview = async (runName: string,
                                    projectUUID: string|undefined,
                                    startDate: Date,
                                    endDate: Date,
                                    topics: string[],
                                    andOr: boolean): Promise<Run[]> => {
  try {
    const formattedStartDate = startDate.toISOString()
    const formattedEndDate = endDate.toISOString();

    const queryParams = new URLSearchParams({
      runName : runName || '',
      projectUUID: projectUUID || '', // Handle undefined projectUUID
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      topics: topics.join(','),
      andOr: andOr ? '1': ''
    }).toString();
    console.log('fetching with: ', queryParams)
    const response = await axios.get(`/run/filtered?${queryParams}`);
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
