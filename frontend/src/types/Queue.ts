import { FileState } from 'src/enum/QUEUE_ENUM';
import { BaseEntity } from 'src/types/BaseEntity';
import { Mission } from 'src/types/Mission';
import { User } from 'src/types/User';

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
