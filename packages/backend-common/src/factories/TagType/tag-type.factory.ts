import { TagTypeEntity } from '@backend-common/entities/tagType/tag-type.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { setSeederFactory } from 'typeorm-extension';

setSeederFactory(TagTypeEntity, (_) => {
    const tagType = new TagTypeEntity();

    const [name, datatype, description] = extendedFaker.tagType.tagType();
    tagType.name = name;
    tagType.datatype = datatype;
    tagType.description = description;
    return tagType;
});
