import type {
    MetadataTypeDto,
    MetadataTypesDto,
} from '@kleinkram/api-dto/types/metadata/metadata.dto';
import { DataType } from '@kleinkram/shared';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

export const getMetadataTypes = async (): Promise<MetadataTypeDto[]> => {
    // The endpoint is paginated (100 by default); callers expect every type.
    const response: AxiosResponse<MetadataTypesDto> = await axios.get(
        '/metadata-types',
        { params: { take: 10_000 } },
    );
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return response.data.data ?? [];
};

export const getFilteredMetadataTypes = async (
    name?: string,
    type?: DataType,
): Promise<MetadataTypesDto> => {
    let response: AxiosResponse<MetadataTypesDto>;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!name && type === null) {
        response = await axios.get<MetadataTypesDto>('/metadata-types');
    } else {
        const parameters: Record<string, string | DataType> = {};
        if (name) {
            parameters.name = name;
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (type !== null) {
            parameters.type = type ?? '';
        }
        response = await axios.get<MetadataTypesDto>(
            `/metadata-types/filtered`,
            {
                params: parameters,
            },
        );
    }
    return response.data;
};
