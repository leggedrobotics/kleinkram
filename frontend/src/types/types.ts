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
  constructor(uuid: string,
              name: string,
              sensorData: SensorData[],
              project: Project,
              date: Date,
              createdAt: Date | null,
              updatedAt: Date | null,
              deletedAt: Date | null) {
    super(uuid, createdAt, updatedAt, deletedAt);
    this.sensorData = sensorData;
    this.project = project;
    this.date = date;
    this.name = name;
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
  constructor(uuid: string, name: string, createdAt: Date | null, updatedAt: Date | null, deletedAt: Date | null) {
    super(uuid, createdAt, updatedAt, deletedAt);
    this.name = name;
  }
}
