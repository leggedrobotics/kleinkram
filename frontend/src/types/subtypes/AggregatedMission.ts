import { Mission } from 'src/types/Mission';
import { Project } from 'src/types/Project';
import { FileEntity } from 'src/types/FileEntity';
import { Tag } from 'src/types/Tag';
import { User } from 'src/types/User';

export class AggregatedMission extends Mission {
    nrFiles: number;
    size: number;

    constructor(
        uuid: string,
        name: string,
        project: Project | null,
        files: FileEntity[],
        tags: Tag[],
        creator: User | null,
        createdAt: Date | null,
        updatedAt: Date | null,
        nrFiles: number,
        size: number,
    ) {
        super(uuid, name, project, files, tags, creator, createdAt, updatedAt);
        this.nrFiles = nrFiles;
        this.size = size;
    }

    clone(): Mission {
        return new AggregatedMission(
            this.uuid,
            this.name,
            this.project?.clone() || null,
            this.files,
            this.tags,
            this.creator,
            this.createdAt,
            this.updatedAt,
            this.nrFiles,
            this.size,
        );
    }

    static fromAPIResponse(response: any): AggregatedMission | null {
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

        return new AggregatedMission(
            response.uuid,
            response.name,
            project,
            files,
            tags,
            creator,
            new Date(response.createdAt),
            new Date(response.updatedAt),
            response.nrFiles,
            response.size,
        );
    }
}
