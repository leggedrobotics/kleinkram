import axios from 'src/api/axios';
import {AnalysisRun, FileEntity, Project, Queue, Run, Topic} from 'src/types/types';

export const fetchOverview = async (runName: string,
                                    projectUUID: string | undefined,
                                    runUUID: string | undefined,
                                    startDate: Date,
                                    endDate: Date,
                                    topics: string[],
                                    andOr: boolean): Promise<Run[]> => {
  try {
    const formattedStartDate = startDate.toISOString()
    const formattedEndDate = endDate.toISOString();

    const queryParams = new URLSearchParams({
      runName: runName || '',
      projectUUID: projectUUID || '',
      runUUID: runUUID || '',
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      topics: topics.join(','),
      andOr: andOr ? '1' : ''
    }).toString();
    const projects: Record<string, Project> = {};
    const runs: Record<string, Run> = {};
    const response = await axios.get(`/file/filtered?${queryParams}`);
    const res = response.data.map((file: any) => {
      const project_uuid: string = file.run.project.uuid;
      let project: Project | undefined = projects[project_uuid];
      if (!project) {
        project = new Project(
          file.run.project.uuid,
          file.run.project.name,
          [],
          new Date(file.run.project.createdAt),
          new Date(file.run.project.updatedAt),
          new Date(file.run.project.deletedAt)
        );
      }
      const run_uuid: string = file.run.uuid;
      let run: Run | undefined = runs[run_uuid];
      if (!run) {
        run = new Run(
          file.run.uuid,
          file.run.name,
          project,
          [],
          new Date(file.run.createdAt),
          new Date(file.run.updatedAt),
          new Date(file.run.deletedAt));
      }
      console.log(file)
      const newFile = new FileEntity(
        file.uuid,
        file.filename,
        file.identifier,
        run,
        new Date(file.date),
        file.topics,
        file.size,
        new Date(file.createdAt),
        new Date(file.updatedAt),
        new Date(file.deletedAt)
      );
      run.files.push(newFile);
      return newFile;

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


export const analysisRuns = async (projectUUID: string, runUUIDs: string) => {

  const params = {
    project_uuid: projectUUID,
    run_uuids: runUUIDs
  };

  const response = await axios.get('/analysis/list', {params});
  return response.data.map((res: any) => {
    return new AnalysisRun(res.uuid, new Date(res.createdAt), new Date(res.updatedAt), new Date(res.deletedAt), res.state, res.image, null)
  });


};
export const currentQueue = async (startDate: Date) => {
  const params = {
    startDate: startDate.toISOString()
  };
  const response = await axios.get('/queue/active', {params});
  return response.data.map((res: any) => {
    return new Queue(res.uuid, res.identifier, res.filename, res.state, res.location, res.run, new Date(res.createdAt), new Date(res.updatedAt), new Date(res.deletedAt));
  })
}

export const fetchFile = async (uuid: string): Promise<FileEntity> => {
  try {
    const response = await axios.get('/file/one', {params: {uuid}});
    const file = response.data;
    console.log(file)
    const project = new Project(
      file.run.project.uuid,
      file.run.project.name,
      [],
      new Date(file.run.project.createdAt),
      new Date(file.run.project.updatedAt),
      new Date(file.run.project.deletedAt)
    );
    const run = new Run(
      file.run.uuid,
      file.run.name,
      project,
      [],
      new Date(file.run.createdAt),
      new Date(file.run.updatedAt),
      new Date(file.run.deletedAt)
    )
    project.runs.push(run);
    const topics = file.topics.map((topic: any) => {
      return new Topic(
        topic.uuid,
        topic.name,
        topic.type,
        topic.nrMessages,
        topic.frequency,
        new Date(topic.createdAt),
        new Date(topic.updatedAt),
        new Date(topic.deletedAt)
      );
    });
    const newFile = new FileEntity(
      file.uuid,
      file.filename,
      file.identifier,
      run,
      new Date(file.date),
      topics,
      file.size,
      new Date(file.createdAt),
      new Date(file.updatedAt),
      new Date(file.deletedAt));
    run.files.push(newFile);
    return newFile
  } catch (error) {
    console.error('Error fetching file:', error);
    throw error; // Rethrow or handle as appropriate
  }
}

export const allTopics = async () => {
  const response = await axios.get('/topic/all');
  return response.data
}

export const downloadBag = async (uuid: string, expires: boolean) => {
  const response = await axios.get('file/download', {
    params: {
      uuid, expires
    }
  });
  return response.data
}

export const allTopicsNames = async (): Promise<string[]> => {
  const response = await axios.get('/topic/names');
  return response.data;
}

export const runsOfProject = async (projectUUID: string): Promise<Run[]> => {

  const response = await axios.get(`/run/filtered/${projectUUID}`);
  return response.data.map((run: any) => {
    const project = new Project(
      run.project.uuid,
      run.project.name,
      [],
      new Date(run.project.createdAt),
      new Date(run.project.updatedAt),
      new Date(run.project.deletedAt)
    );
    const runEntity = new Run(
      run.uuid,
      run.name,
      project,
      [],
      new Date(run.createdAt),
      new Date(run.updatedAt),
      new Date(run.deletedAt)
    );
    return runEntity;
  })
}
