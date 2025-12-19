import { FileEntity } from '@backend-common/entities/file/file.entity';
import { TopicEntity } from '@backend-common/entities/topic/topic.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { type Faker } from '@faker-js/faker';
import { setSeederFactory } from 'typeorm-extension';

export interface TopicContext {
    file: FileEntity;
    name?: string;
    type?: string;
    frequency?: number;
    nrMessages?: bigint;
    messageEncoding?: string;
}

setSeederFactory(
    TopicEntity,
    (faker: Faker, context: Partial<TopicContext> = {}) => {
        const topic = new TopicEntity();
        topic.name = context.name ?? extendedFaker.ros.topic();
        topic.uuid = extendedFaker.string.uuid();
        topic.frequency =
            context.frequency ?? extendedFaker.number.int({ min: 0, max: 100 });
        // @ts-ignore
        topic.file = context.file;
        topic.nrMessages =
            context.nrMessages ??
            extendedFaker.number.bigInt({
                min: 0,
                max: 1_000_000_000,
            });
        topic.type = context.type ?? extendedFaker.ros.topicType();
        if (context.messageEncoding) {
            topic.messageEncoding = context.messageEncoding;
        }

        return topic;
    },
);
