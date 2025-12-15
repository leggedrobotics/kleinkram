import { CategoryEntity } from '@backend-common/entities/category/category.entity';
import { FileEntity } from '@backend-common/entities/file/file.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { FileOrigin, FileState, FileType } from '@kleinkram/shared';
import { define } from 'typeorm-seeding';

export interface FileContext {
    mission: MissionEntity;
    user: UserEntity;
    filename?: string;
    size?: number;
    type?: FileType;
    categories?: CategoryEntity[];
    origin?: FileOrigin;
    hash?: string;
}

define(FileEntity, (_, context: Partial<FileContext> = {}) => {
    if (!context.mission) {
        throw new Error('Mission is required');
    }

    if (!context.user) {
        throw new Error('User is required');
    }

    const file = new FileEntity();
    file.date = extendedFaker.date.recent();
    file.type = context.type ?? extendedFaker.ros.fileType();

    // Use provided filename or generate one with unique suffix
    if (context.filename) {
        file.filename = context.filename;
    } else {
        const uniqueSuffix = extendedFaker.string.alpha({ length: 8 });
        file.filename = `${extendedFaker.ros.fileName(file.type)}_${uniqueSuffix}`;
    }

    file.mission = context.mission;

    // Use provided size or generate a random one
    file.size = context.size ?? extendedFaker.number.int({ min: 0, max: 2e12 }); // 0 bytes to 2 TB

    file.creator = context.user;
    file.state = FileState.OK;
    file.origin = context.origin;
    file.hash = context.hash;
    file.topics = [];
    if (context.categories) {
        file.categories = context.categories;
    }
    return file;
});
