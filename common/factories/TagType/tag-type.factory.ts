import { define } from 'typeorm-seeding';
import TagType from '../../entities/tagType/tag-type.entity';
import { extendedFaker } from '../../faker-extended';

define(TagType, () => {
    const tagType = new TagType();

    const [name, datatype, description] = extendedFaker.tagType.tagType();
    tagType.name = name;
    tagType.datatype = datatype;
    tagType.description = description;
    return tagType;
});
