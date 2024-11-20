import { BaseEntity } from 'src/types/BaseEntity';
import { Mission } from 'src/types/Mission';
import { User } from 'src/types/User';
import { QueueState } from '@common/enum';

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

    static fromAPIResponse(response: any): Queue {
        const mission = Mission.fromAPIResponse(response.mission);
        const creator = User.fromAPIResponse(response.creator);
        return new Queue(
            response.uuid,
            response.identifier,
            response.displayName,
            response.state,
            response.location,
            mission,
            creator,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}
