import { FileState, FileType } from 'src/enums/FILE_ENUM';
import { BaseEntity } from 'src/types/BaseEntity';
import { Mission } from 'src/types/Mission';
import { User } from 'src/types/User';
import { Topic } from 'src/types/Topic';
import { Category } from 'src/types/Category';

export class FileEntity extends BaseEntity {
    filename: string;
    mission: Mission | null;
    date: Date;
    topics: Topic[];
    size: number;
    creator: User | null;
    type: FileType;
    state: FileState;
    hash: string;
    categories: Category[];

    constructor(
        uuid: string,
        filename: string,
        mission: Mission | null,
        creator: User | null,
        date: Date,
        topics: Topic[],
        size: number,
        type: FileType,
        state: FileState,
        hash: string,
        categories: Category[],
        createdAt: Date | null,
        updatedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt);
        this.size = size;
        this.mission = mission;
        this.creator = creator;
        this.date = date;
        this.filename = filename;
        this.topics = topics;
        this.type = type;
        this.state = state;
        this.hash = hash;
        this.categories = categories;
    }

    static fromAPIResponse(response: any): FileEntity {
        const mission = Mission.fromAPIResponse(response.mission);
        const creator = User.fromAPIResponse(response.creator);

        let topics: Topic[] = [];
        if (response.topics) {
            topics = response.topics.map((topic: any) =>
                Topic.fromAPIResponse(topic),
            );
        }

        let categories: Category[] = [];
        if (response.categories) {
            categories = response.categories.map((category: any) =>
                Category.fromAPIResponse(category),
            );
        }

        return new FileEntity(
            response.uuid,
            response.filename,
            mission,
            creator,
            new Date(response.date),
            topics,
            response.size,
            response.type,
            response.state,
            response.hash,
            categories,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}
