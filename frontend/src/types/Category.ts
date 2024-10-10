import { BaseEntity } from 'src/types/BaseEntity';
import { Project } from 'src/types/Project';
import { FileEntity } from 'src/types/FileEntity';

export class Category extends BaseEntity {
    name: string;
    project: Project;
    files: FileEntity[];

    constructor(
        uuid: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
        name: string,
        project: Project,
        files: FileEntity[],
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.name = name;
        this.project = project;
        this.files = files;
    }
}
