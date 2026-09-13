import { FileEntity } from '@backend-common/entities/file/file.entity';
import { TopicEntity } from '@backend-common/entities/topic/topic.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { setSeederFactory } from 'typeorm-extension';

export interface TopicContext {
    file: FileEntity;
    name?: string;
    type?: string;
    frequency?: number;
    nrMessages?: bigint;
    messageEncoding?: string;
}

/**
 * Topics belong to a concrete file version, so the seeded file has to have an
 * active version by the time its topics are created.
 */
const fileVersionUuidOf = (file: FileEntity): string => {
    const versionUuid = file.activeVersion?.uuid ?? file.activeVersionUuid;
    if (!versionUuid) {
        throw new Error(
            `Cannot seed a topic for "${file.filename}": the file has no active version`,
        );
    }
    return versionUuid;
};

setSeederFactory(TopicEntity, (context: Partial<TopicContext> = {}) => {
    const topic = new TopicEntity();
    topic.name = context.name ?? extendedFaker.ros.topic();
    topic.uuid = extendedFaker.string.uuid();
    topic.frequency =
        context.frequency ?? extendedFaker.number.int({ min: 0, max: 100 });
    if (context.file) {
        topic.fileVersionUuid = fileVersionUuidOf(context.file);
    }
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
});
