import { BaseEntity } from 'src/types/BaseEntity';
import { Project } from 'src/types/Project';
import { User } from 'src/types/User';
import { FileEntity } from 'src/types/FileEntity';
import { Tag } from 'src/types/Tag';

export class Mission extends BaseEntity {
    name: string;
    project: Project | undefined;
    files: FileEntity[];
    creator?: User;
    tags: Tag[];

    constructor(
        uuid: string,
        name: string,
        project: Project | undefined,
        files: FileEntity[],
        tags: Tag[],
        creator: User | undefined,
        createdAt: Date | null,
        updatedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt);
        this.name = name;
        this.project = project;
        this.files = files;
        this.creator = creator;
        this.tags = tags;
    }

    clone(): Mission {
        return new Mission(
            this.uuid,
            this.name,
            this.project?.clone(),
            this.files,
            this.tags,
            this.creator,
            this.createdAt,
            this.updatedAt,
        );
    }
}
