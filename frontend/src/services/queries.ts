import axios from 'src/api/axios';
import {AnalysisRun, FileEntity, Project, Queue, Run, Topic, User} from 'src/types/types';

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
      fileName: runName || '',
      projectUUID: projectUUID || '',
      runUUID: runUUID || '',
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      topics: topics.join(','),
      andOr: andOr ? '1' : ''
    }).toString();
    const projects: Record<string, Project> = {};
    const creator: Record<string, User> = {};
    const runs: Record<string, Run> = {};
    const response = await axios.get(`/file/filtered?${queryParams}`);
    return response.data.map((file: any) => {
      const project_uuid: string = file.run.project.uuid;
      let project: Project | undefined = projects[project_uuid];
      if (!project) {
        project = new Project(
          file.run.project.uuid,
          file.run.project.name,
          file.run.project.description,
          [],
          file.run.project.creator,
          new Date(file.run.project.createdAt),
          new Date(file.run.project.updatedAt),
          new Date(file.run.project.deletedAt)
        );
      }
      let user: User | undefined = creator[file.creator.uuid];
      if (!user) {
        user = new User(
          file.creator.uuid,
          file.creator.name,
          file.creator.email,
          file.creator.role,
          file.creator.googleId,
          [],
          new Date(file.creator.createdAt),
          new Date(file.creator.updatedAt),
          new Date(file.creator.deletedAt)
        );
        creator[file.creator.uuid] = user;
      }
      const run_uuid: string = file.run.uuid;
      let run: Run | undefined = runs[run_uuid];
      if (!run) {
        run = new Run(
          file.run.uuid,
          file.run.name,
          project,
          [],
          file.run.creator,
          new Date(file.run.createdAt),
          new Date(file.run.updatedAt),
          new Date(file.run.deletedAt));
      }
      const newFile = new FileEntity(
        file.uuid,
        file.filename,
        file.identifier,
        run,
        user,
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
    return new AnalysisRun(res.uuid, new Date(res.createdAt), new Date(res.updatedAt), new Date(res.deletedAt), res.state, res.docker_image, null)
  });
};

export const analysisDetails = async (analysis_uuid: string) => {
  const params = {
    analysis_uuid: analysis_uuid
  };

  const response = await axios.get('/analysis/details', {params});
  console.log(response.data);
  return new AnalysisRun(response.data.uuid, new Date(response.data.createdAt), new Date(response.data.updatedAt), new Date(response.data.deletedAt), response.data.state, response.data.docker_image, null, response.data.logs);
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
    const project = new Project(
      file.run.project.uuid,
      file.run.project.name,
      file.run.project.description,
      [],
      undefined,
      new Date(file.run.project.createdAt),
      new Date(file.run.project.updatedAt),
      new Date(file.run.project.deletedAt)
    );

    const run = new Run(
      file.run.uuid,
      file.run.name,
      project,
      [],
      undefined,
      new Date(file.run.createdAt),
      new Date(file.run.updatedAt),
      new Date(file.run.deletedAt)
    )
    const creator = new User(
      file.creator.uuid,
      file.creator.name,
      file.creator.email,
      file.creator.role,
      file.creator.googleId,
      [],
      new Date(file.creator.createdAt),
      new Date(file.creator.updatedAt),
      new Date(file.creator.deletedAt)
    );


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
      creator,
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
  const users: Record<string, User> = {};
  return response.data.map((run: any) => {

    const project = new Project(
      run.project.uuid,
      run.project.name,
      run.project.description,
      [],
      undefined,
      new Date(run.project.createdAt),
      new Date(run.project.updatedAt),
      new Date(run.project.deletedAt)
    );
    let runCreator: User | undefined = users[run.creator.uuid];
    if (!runCreator) {
      runCreator = new User(
        run.creator.uuid,
        run.creator.name,
        run.creator.email,
        run.creator.role,
        run.creator.googleId,
        [],
        new Date(run.creator.createdAt),
        new Date(run.creator.updatedAt),
        new Date(run.creator.deletedAt)
      );
      users[run.creator.uuid] = runCreator;
    }
    const runEntity = new Run(
      run.uuid,
      run.name,
      project,
      [],
      runCreator,
      new Date(run.createdAt),
      new Date(run.updatedAt),
      new Date(run.deletedAt)
    );
    runEntity.files = run.files.map((file: any) => {
      let fileCreator: User | undefined = users[file.creator.uuid];
      if (!fileCreator) {
        fileCreator = new User(
          file.creator.uuid,
          file.creator.name,
          file.creator.email,
          file.creator.role,
          file.creator.googleId,
          [],
          new Date(file.creator.createdAt),
          new Date(file.creator.updatedAt),
          new Date(file.creator.deletedAt)
        );
        users[file.creator.uuid] = fileCreator;
      }
      return new FileEntity(
        file.uuid,
        file.filename,
        file.identifier,
        runEntity,
        fileCreator,
        new Date(file.date),
        file.topics,
        file.size,
        new Date(file.createdAt),
        new Date(file.updatedAt),
        new Date(file.deletedAt)
      );
    });
    return runEntity;
  });
}

export const filesOfRun = async (runUUID: string): Promise<FileEntity[]> => {
  const response = await axios.get('file/ofRun', {params: {runUUID}});
  if (response.data.length === 0) {
    return [];
  }
  const users: Record<string, User> = {};
  let runCreator: User | undefined = users[response.data[0].run.creator.uuid];
  if (!runCreator) {
    runCreator = new User(
      response.data[0].run.creator.uuid,
      response.data[0].run.creator.name,
      response.data[0].run.creator.email,
      response.data[0].run.creator.role,
      response.data[0].run.creator.googleId,
      [],
      new Date(response.data[0].run.creator.createdAt),
      new Date(response.data[0].run.creator.updatedAt),
      new Date(response.data[0].run.creator.deletedAt)
    );
    users[response.data[0].run.creator.uuid] = runCreator;
  }
  const run = new Run(
    runUUID,
    response.data[0].run.name,
    undefined,
    [],
    runCreator,
    new Date(response.data[0].run.createdAt),
    new Date(response.data[0].run.updatedAt),
    new Date(response.data[0].run.deletedAt)
  )
  return response.data.map((file: any) => {
    let fileCreator: User | undefined = users[file.creator.uuid];
    if (!fileCreator) {
      fileCreator = new User(
        file.creator.uuid,
        file.creator.name,
        file.creator.email,
        file.creator.role,
        file.creator.googleId,
        [],
        new Date(file.creator.createdAt),
        new Date(file.creator.updatedAt),
        new Date(file.creator.deletedAt)
      );
      users[file.creator.uuid] = fileCreator;
    }
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
      fileCreator,
      new Date(file.date),
      topics,
      file.size,
      new Date(file.createdAt),
      new Date(file.updatedAt),
      new Date(file.deletedAt)
    );
    run.files.push(newFile);
    return newFile;
  });
}

export const getProject = async (uuid: string): Promise<Project> => {
  const response = await axios.get('/project/one', {params: {uuid}});
  const project = response.data;
  const creator = new User(
    project.creator.uuid,
    project.creator.name,
    project.creator.email,
    project.creator.role,
    project.creator.googleId,
    [],
    new Date(project.creator.createdAt),
    new Date(project.creator.updatedAt),
    new Date(project.creator.deletedAt)
  );
  const runs: Run[] = project.runs.map((run: any) => {
    return new Run(
      run.uuid,
      run.name,
      undefined,
      [],
      undefined,
      new Date(run.createdAt),
      new Date(run.updatedAt),
      new Date(run.deletedAt)
    );
  })
  return new Project(
    project.uuid,
    project.name,
    project.description,
    runs,
    creator,
    new Date(project.createdAt),
    new Date(project.updatedAt),
    new Date(project.deletedAt)
  );
}
