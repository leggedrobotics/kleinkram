import { BaseEntity } from 'src/types/BaseEntity';
import { Project } from 'src/types/Project';
import { User } from 'src/types/User';
import { FileEntity } from 'src/types/FileEntity';
import { Tag } from 'src/types/Tag';

export class Mission extends BaseEntity {
    name: string;
    project: Project | null;
    files: FileEntity[];
    creator: User | null;
    tags: Tag[];

    constructor(
        uuid: string,
        name: string,
        project: Project | null,
        files: FileEntity[],
        tags: Tag[],
        creator: User | null,
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
            this.project?.clone() || null,
            this.files,
            this.tags,
            this.creator,
            this.createdAt,
            this.updatedAt,
        );
    }

    static fromAPIResponse(response: any): Mission | null {
        if (!response) {
            return null;
        }
        const project = Project.fromAPIResponse(response.project);
        const creator = User.fromAPIResponse(response.creator);

        let files: FileEntity[] = [];
        if (response.files) {
            files = response.files.map((file: any) =>
                FileEntity.fromAPIResponse(file),
            );
        }

        let tags: Tag[] = [];
        if (response.tags) {
            tags = response.tags.map((tag: any) => Tag.fromAPIResponse(tag));
        }
        return new Mission(
            response.uuid,
            response.name,
            project,
            files,
            tags,
            creator,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}
