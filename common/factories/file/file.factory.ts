import { define } from 'typeorm-seeding';
import FileEntity from '../../entities/file/file.entity';
import Mission from '../../entities/mission/mission.entity';
import User from '../../entities/user/user.entity';
import { extendedFaker } from '../../faker_extended';
import { FileState } from '../../frontend_shared/enum';

export type FileContext = {
    mission: Mission;
    user: User;
};

define(FileEntity, (_, context: Partial<FileContext> = {}) => {
    const file = new FileEntity();
    file.date = extendedFaker.date.recent();
    file.type = extendedFaker.ros.fileType();
    file.filename = extendedFaker.ros.fileName(file.type);
    file.mission = context.mission || null;
    file.size = extendedFaker.number.int({ min: 0, max: 2e12 }); // 0 bytes to 2 TB
    file.creator = context.user || null;
    file.state = FileState.OK;
    file.topics = [];
    return file;
});
