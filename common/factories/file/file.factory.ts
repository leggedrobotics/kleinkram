import { define } from 'typeorm-seeding';
import CategoryEntity from '../../entities/category/category.entity';
import FileEntity from '../../entities/file/file.entity';
import MissionEntity from '../../entities/mission/mission.entity';
import UserEntity from '../../entities/user/user.entity';
import { extendedFaker } from '../../faker-extended';
import { FileState, FileType } from '../../frontend_shared/enum';

export interface FileContext {
    mission: MissionEntity;
    user: UserEntity;
    filename?: string;
    size?: number;
    type?: FileType;
    categories?: CategoryEntity[];
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
    file.topics = [];
    if (context.categories) {
        file.categories = context.categories;
    }
    return file;
});
