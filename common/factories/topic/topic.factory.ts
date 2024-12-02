import { define } from 'typeorm-seeding';
import FileEntity from '../../entities/file/file.entity';
import Topic from '../../entities/topic/topic.entity';
import { extendedFaker } from '../../faker_extended';

export interface TopicContext {
    file: FileEntity;
}

define(Topic, (_, context: Partial<TopicContext> = {}) => {
    const topic = new Topic();
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
