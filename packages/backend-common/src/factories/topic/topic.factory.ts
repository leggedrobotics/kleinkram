import FileEntity from '@backend-common/entities/file/file.entity';
import TopicEntity from '@backend-common/entities/topic/topic.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { define } from 'typeorm-seeding';

export interface TopicContext {
    file: FileEntity;
}

define(TopicEntity, (_, context: Partial<TopicContext> = {}) => {
    const topic = new TopicEntity();
    topic.name = extendedFaker.ros.topic();
    topic.uuid = extendedFaker.string.uuid();
    topic.frequency = extendedFaker.number.int({ min: 0, max: 100 });
    // @ts-ignore
    topic.file = context.file;
    topic.nrMessages = extendedFaker.number.bigInt({
        min: 0,
        max: 1_000_000_000,
    });
    topic.type = extendedFaker.ros.topicType();

    return topic;
});
