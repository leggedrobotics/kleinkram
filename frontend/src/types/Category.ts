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
        name: string,
        project: Project,
        files: FileEntity[],
    ) {
        super(uuid, createdAt, updatedAt);
        this.name = name;
        this.project = project;
        this.files = files;
    }

    static fromAPIResponse(response: any): Category {
        const project = Project.fromAPIResponse(response.project);
        const files =
            response.files?.map((file: any) =>
                FileEntity.fromAPIResponse(file),
            ) || [];
        return new Category(
            response.uuid,
            new Date(response.createdAt),
            new Date(response.updatedAt),
            response.name,
            project,
            files,
        );
    }
}
