import { MetadataTypeEntity } from '@backend-common/entities/metadata/metadata-type.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { setSeederFactory } from 'typeorm-extension';

setSeederFactory(MetadataTypeEntity, (_) => {
    const metadataType = new MetadataTypeEntity();

    const [name, datatype, description] =
        extendedFaker.metadataType.metadataType();
    metadataType.name = name;
    metadataType.datatype = datatype;
    metadataType.description = description;
    return metadataType;
});
