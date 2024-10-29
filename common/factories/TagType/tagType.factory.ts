import { define } from 'typeorm-seeding';
import { extendedFaker } from '../../faker_extended';
import TagType from '../../entities/tagType/tagType.entity';

define(TagType, () => {
    const tagType = new TagType();

    const [name, datatype, description] = extendedFaker.tagType.tagType();
    tagType.name = name;
    tagType.datatype = datatype;
    tagType.description = description;
    return tagType;
});
