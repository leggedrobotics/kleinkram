import {AnalysisRunState, FileState} from 'src/enum/QUEUE_ENUM';

class BaseEntity {
  uuid: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  deletedAt: Date | null;

  constructor(uuid: string, createdAt: Date | null, updatedAt: Date | null, deletedAt: Date | null) {
    this.uuid = uuid;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.deletedAt = deletedAt;
  }
}

export class Project extends BaseEntity {
  name: string;
  runs: Run[];

  constructor(uuid: string, name: string, runs: Run[], createdAt: Date | null, updatedAt: Date | null, deletedAt: Date | null) {
    super(uuid, createdAt, updatedAt, deletedAt);
    this.name = name;
    this.runs = runs;
  }

  clone(): Project {
    return new Project(this.uuid, this.name, this.runs, this.createdAt, this.updatedAt, this.deletedAt);
  }
}

export class Run extends BaseEntity {
  name: string;
  project: Project;
  files: FileEntity[];

  constructor(uuid: string, name: string, project: Project, files: FileEntity[], createdAt: Date | null, updatedAt: Date | null, deletedAt: Date | null) {
    super(uuid, createdAt, updatedAt, deletedAt);
    this.name = name;
    this.project = project;
    this.files = files;
  }

  clone(): Run {
    return new Run(this.uuid, this.name, this.project.clone(), this.files, this.createdAt, this.updatedAt, this.deletedAt);
  }
}

export class FileEntity extends BaseEntity {
  filename: string;
  run: Run;
  date: Date;
  topics: Topic[];
  size: number;
  identifier: string;

  constructor(uuid: string,
              filename: string,
              identifier: string,
              run: Run,
              date: Date,
              topics: Topic[],
              size: number,
              createdAt: Date | null,
              updatedAt: Date | null,
              deletedAt: Date | null) {
    super(uuid, createdAt, updatedAt, deletedAt);
    this.size = size;
    this.run = run;
    this.date = date;
    this.filename = filename;
    this.identifier = identifier;
    this.topics = topics;
  }
}

export class AnalysisRun extends BaseEntity {

  state: AnalysisRunState;
  docker_image: string;

  run: Run | null

  constructor(
    uuid: string,
    createdAt: Date | null,
    updatedAt: Date | null,
    deletedAt: Date | null,
    state: AnalysisRunState,
    docker_image: string,
    run: Run | null
  ) {
    super(uuid, createdAt, updatedAt, deletedAt);

    this.state = state;
    this.docker_image = docker_image;
    this.run = run;

  }


}

export class Topic extends BaseEntity {
  name: string;
  type: string;
  nrMessages: number;
  frequency: number;

  constructor(uuid: string, name: string, type: string, nrMessages: number, frequency: number, createdAt: Date | null, updatedAt: Date | null, deletedAt: Date | null) {
    super(uuid, createdAt, updatedAt, deletedAt);
    this.name = name;
    this.type = type;
    this.nrMessages = nrMessages;
    this.frequency = frequency;
  }
}

export class Queue extends BaseEntity {
  identifier: string;
  filename: string;
  state: FileState;
  location: string;
  run: Run;

  constructor(uuid: string, identifier: string, filename: string, state: FileState, location: string, run: Run, createdAt: Date | null, updatedAt: Date | null, deletedAt: Date | null) {
    super(uuid, createdAt, updatedAt, deletedAt);
    this.filename = filename;
    this.identifier = identifier;
    this.state = state;
    this.location = location;
    this.run = run;
  }
}
