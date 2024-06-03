import { ActionState, FileState } from 'src/enum/QUEUE_ENUM';
import ROLE from 'src/enum/USER_ROLES';

class BaseEntity {
    uuid: string;
    createdAt: Date | null;
    updatedAt: Date | null;
    deletedAt: Date | null;

    constructor(
        uuid: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
    ) {
        this.uuid = uuid;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.deletedAt = deletedAt;
    }
}

export class User extends BaseEntity {
    name: string;
    email: string;
    role: ROLE;
    googleId: string;
    projects: Project[];

    constructor(
        uuid: string,
        name: string,
        email: string,
        role: ROLE,
        googleId: string,
        projects: Project[],
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.name = name;
        this.email = email;
        this.role = role;
        this.googleId = googleId;
        this.projects = projects;
    }
}

export class Project extends BaseEntity {
    name: string;
    description: string;
    missions: Mission[];
    creator?: User;

    constructor(
        uuid: string,
        name: string,
        description: string,
        missions: Mission[],
        creator: User | undefined,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.name = name;
        this.creator = creator;
        this.missions = missions;
        this.description = description;
    }

    clone(): Project {
        return new Project(
            this.uuid,
            this.name,
            this.description,
            this.missions,
            this.creator,
            this.createdAt,
            this.updatedAt,
            this.deletedAt,
        );
    }
}

export class Mission extends BaseEntity {
    name: string;
    project: Project | undefined;
    files: FileEntity[];
    creator?: User;

    constructor(
        uuid: string,
        name: string,
        project: Project | undefined,
        files: FileEntity[],
        creator: User | undefined,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.name = name;
        this.project = project;
        this.files = files;
        this.creator = creator;
    }

    clone(): Mission {
        return new Mission(
            this.uuid,
            this.name,
            this.project?.clone(),
            this.files,
            this.creator,
            this.createdAt,
            this.updatedAt,
            this.deletedAt,
        );
    }
}

export class FileEntity extends BaseEntity {
    filename: string;
    mission: Mission;
    date: Date;
    topics: Topic[];
    size: number;
    creator: User;

    constructor(
        uuid: string,
        filename: string,
        mission: Mission,
        creator: User,
        date: Date,
        topics: Topic[],
        size: number,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.size = size;
        this.mission = mission;
        this.creator = creator;
        this.date = date;
        this.filename = filename;
        this.topics = topics;
    }
}

type ContainerLog = {
    timestamp: string;
    message: string;
    type: 'stdout' | 'stderr';
};

export class Action extends BaseEntity {
    state: ActionState;
    docker_image: string;

    mission: Mission | null;
    logs: ContainerLog[] | null;

    constructor(
        uuid: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
        state: ActionState,
        docker_image: string,
        mission: Mission | null,
        logs: ContainerLog[] | null = null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);

        this.state = state;
        this.docker_image = docker_image;
        this.mission = mission;
        this.logs = logs;
    }
}

export class Topic extends BaseEntity {
    name: string;
    type: string;
    nrMessages: number;
    frequency: number;

    constructor(
        uuid: string,
        name: string,
        type: string,
        nrMessages: number,
        frequency: number,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
    ) {
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
    mission: Mission;
    creator: User;

    constructor(
        uuid: string,
        identifier: string,
        filename: string,
        state: FileState,
        location: string,
        mission: Mission,
        creator: User,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.filename = filename;
        this.identifier = identifier;
        this.state = state;
        this.location = location;
        this.mission = mission;
        this.creator = creator;
    }
}
