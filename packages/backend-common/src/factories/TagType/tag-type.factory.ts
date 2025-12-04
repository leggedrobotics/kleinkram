import TagTypeEntity from '@backend-common/entities/tagType/tag-type.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { define } from 'typeorm-seeding';

define(TagTypeEntity, () => {
    const tagType = new TagTypeEntity();

    const [name, datatype, description] = extendedFaker.tagType.tagType();
    tagType.name = name;
    tagType.datatype = datatype;
    tagType.description = description;
    return tagType;
});
