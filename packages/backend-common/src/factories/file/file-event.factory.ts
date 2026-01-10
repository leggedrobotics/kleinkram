import { FileEventEntity } from '@backend-common/entities/file/file-event.entity';
import { FileEntity } from '@backend-common/entities/file/file.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { type Faker } from '@faker-js/faker';
import { FileEventType } from '@kleinkram/shared';
import { setSeederFactory } from 'typeorm-extension';

export interface FileEventContext {
    file: FileEntity;
    mission: MissionEntity;
    actor: UserEntity;
    type: FileEventType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: Record<string, any>;
}

setSeederFactory(
    FileEventEntity,
    (faker: Faker, context: Partial<FileEventContext> = {}) => {
        const { file, mission, actor, type, details } = context;

        if (!file) {
            throw new Error('File is required');
        }
        if (!type) {
            throw new Error('Type is required');
        }

        if (!mission) {
            throw new Error('Mission is required');
        }
        if (!actor) {
            throw new Error('Actor is required');
        }

        const event = new FileEventEntity();
        event.file = file;
        event.mission = mission;
        event.actor = actor;
        event.type = type;
        event.details = details ?? {};
        event.filenameSnapshot = file.filename;

        return event;
    },
);
