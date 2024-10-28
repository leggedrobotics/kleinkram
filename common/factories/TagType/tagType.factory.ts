import { define } from 'typeorm-seeding';
import { extendedFaker } from '../../faker_extended';
import TagType from '../../entities/tagType/tagType.entity';

export type TagTypeFactoryContext = {};

define(TagType, (_, context: Partial<TagTypeFactoryContext> = {}) => {
    const tagType = new TagType();

    const [name, datatype, description] = extendedFaker.tagType.tagType();
    tagType.name = name;
    tagType.datatype = datatype;
    tagType.description = description;
    return tagType;
});
