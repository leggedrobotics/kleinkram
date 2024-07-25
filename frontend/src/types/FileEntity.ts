import { FileType } from 'src/enum/FILE_ENUM';
import { BaseEntity } from 'src/types/BaseEntity';
import { Mission } from 'src/types/Mission';
import { User } from 'src/types/User';
import { Topic } from 'src/types/Topic';

export class FileEntity extends BaseEntity {
    filename: string;
    mission: Mission | null;
    date: Date;
    topics: Topic[];
    size: number;
    creator: User;
    type: FileType;

    constructor(
        uuid: string,
        filename: string,
        mission: Mission | null,
        creator: User,
        date: Date,
        topics: Topic[],
        size: number,
        type: FileType,
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
        this.type = type;
    }
}
