import { define } from 'typeorm-seeding';
import FileEntity from '../../entities/file/file.entity';
import Mission from '../../entities/mission/mission.entity';
import User from '../../entities/user/user.entity';
import { extendedFaker } from '../../faker-extended';
import { FileState } from '../../frontend_shared/enum';

export interface FileContext {
    mission: Mission;
    user: User;
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
    file.type = extendedFaker.ros.fileType();
    const uniqueSuffix = extendedFaker.string.alpha({ length: 8 });
    file.filename = `${extendedFaker.ros.fileName(file.type)}_${uniqueSuffix}`;
    file.mission = context.mission;
    file.size = extendedFaker.number.int({ min: 0, max: 2e12 }); // 0 bytes to 2 TB
    file.creator = context.user;
    file.state = FileState.OK;
    file.topics = [];
    return file;
});
