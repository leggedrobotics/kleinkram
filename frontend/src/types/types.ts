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

export class Project extends BaseEntity{
    name: string;
    runs: Run[];
    constructor(uuid: string, name: string, runs: Run[], createdAt: Date | null, updatedAt: Date | null, deletedAt: Date | null) {
      super(uuid, createdAt, updatedAt, deletedAt);
      this.name = name;
      this.runs = runs;
    }
}


export class Run extends BaseEntity {
  name: string;
  sensorData: SensorData[];
  project: Project;
  date: Date;
  topics: Topic[];
  constructor(uuid: string,
              name: string,
              sensorData: SensorData[],
              project: Project,
              date: Date,
              topics: Topic[],
              createdAt: Date | null,
              updatedAt: Date | null,
              deletedAt: Date | null) {
    super(uuid, createdAt, updatedAt, deletedAt);
    this.sensorData = sensorData;
    this.project = project;
    this.date = date;
    this.name = name;
    this.topics = topics;
  }
}

export class SensorData extends BaseEntity {
    run: Run;
    constructor(uuid: string, run: Run, createdAt: Date | null, updatedAt: Date | null, deletedAt: Date | null) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.run = run;
    }
}

export class Topic extends BaseEntity {
  name: string;
  type: string;
  nrMessages: number;
  frequency: number;
  constructor(uuid: string, name: string, type:string, nrMessages: number, frequency: number, createdAt: Date | null, updatedAt: Date | null, deletedAt: Date | null) {
    super(uuid, createdAt, updatedAt, deletedAt);
    this.name = name;
    this.type = type;
    this.nrMessages = nrMessages;
    this.frequency = frequency;
  }
}
