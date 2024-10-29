import { QueueState } from 'src/enums/QUEUE_ENUM';
import { BaseEntity } from 'src/types/BaseEntity';
import { Mission } from 'src/types/Mission';
import { User } from 'src/types/User';

export class Queue extends BaseEntity {
    identifier: string;
    displayName: string;
    state: QueueState;
    location: string;
    mission: Mission;
    creator: User;

    constructor(
        uuid: string,
        identifier: string,
        displayName: string,
        state: QueueState,
        location: string,
        mission: Mission,
        creator: User,
        createdAt: Date | null,
        updatedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt);
        this.displayName = displayName;
        this.identifier = identifier;
        this.state = state;
        this.location = location;
        this.mission = mission;
        this.creator = creator;
    }
}
