import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type {
    MetadataDto,
    MetadataTypeDto,
} from '@kleinkram/api-dto/types/metadata/metadata.dto';
import type { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import { DataType } from '@kleinkram/shared';
import { formatDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';

import type { ProjectWithAccessRightsDto } from '@kleinkram/api-dto/types/project/project-access.dto';
import type { ProjectWithMissionCountDto } from '@kleinkram/api-dto/types/project/project-with-mission-count.dto';
import type { ConfigurableColumn } from 'src/composables/use-table-columns';

export interface ProjectColumnType extends ConfigurableColumn {
    required?: boolean;
    align: string;
    field?:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        | ((row: ProjectWithMissionCountDto) => any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        | ((row: ProjectWithAccessRightsDto) => any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        | ((row: FlatMissionDto) => any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        | ((row: FileWithTopicDto) => any);
    format?: ((value: string) => string) | ((value: number) => string);
    /** Set on the per-metadata-type columns of the missions table. */
    metadataType?: MetadataTypeDto;
    sortable?: boolean;
    sort?: (
        _a: string,
        _b: string,
        a: FileWithTopicDto,
        b: FileWithTopicDto,
    ) => number;
}

export const explorerPageTableColumns: ProjectColumnType[] = [
    {
        name: 'star',
        configurable: false,
        required: true,
        label: '',
        align: 'center',
        style: 'width: 10px',
    },
    {
        name: 'name',
        alwaysVisible: true,
        required: true,
        label: 'Project Name',
        align: 'left',
        field: (row: ProjectWithMissionCountDto) => row.name,
        format: (value: string) => value,
        sortable: true,
        style: 'width: 140px',
    },
    {
        name: 'description',
        required: true,
        label: 'Description',
        align: 'left',
        field: (row: ProjectWithMissionCountDto) => row.description,
        format: (value: string) => value,
        sortable: true,
    },

    {
        name: 'creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: ProjectWithMissionCountDto) => row.creator.name,
        format: (value: number) => value.toString(),
        style: 'min-width: 100px',
        sortable: true,
    },
    {
        name: 'createdAt',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: ProjectWithMissionCountDto) => row.createdAt,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'nrOfMissions',
        required: true,
        label: '# Missions',
        align: 'right',
        classes: 'kk-num',
        headerClasses: 'kk-num',
        style: 'min-width: 100px',
        field: (row: ProjectWithMissionCountDto) => row.missionCount,
        format: (value: number) => value.toString(),
        sortable: true,
    },
    {
        name: 'size',
        required: true,
        label: 'Size',
        align: 'right',
        classes: 'kk-num',
        headerClasses: 'kk-num',
        field: (row: ProjectWithMissionCountDto) => row.size,
        format: formatSize,
        sortable: true,
    },
    {
        name: 'project-action',
        configurable: false,
        label: '',
        style: 'width: 10px',
        align: 'center',
    },
];

export const projectAccessColumns: ProjectColumnType[] = [
    {
        name: 'name',
        required: true,
        label: 'Project Name',
        align: 'left',
        field: (row: ProjectWithAccessRightsDto) => row.name,
        format: (value: string) => value,
        sortable: true,
        style: 'width: 140px',
    },
    {
        name: 'description',
        required: true,
        label: 'Description',
        align: 'left',
        field: (row: ProjectWithAccessRightsDto) => row.description,
        format: (value: string) => value,
        sortable: true,
    },
    {
        name: 'createdAt',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: ProjectWithAccessRightsDto) => row.createdAt,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'project-action',
        configurable: false,
        label: '',
        style: 'width: 10px',
        align: 'center',
    },
];

export const missionColumns: ProjectColumnType[] = [
    {
        name: 'name',
        alwaysVisible: true,
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: FlatMissionDto) => row.name,
        format: (value: string) => value,
        sortable: true,
    },
    {
        name: 'filesCount',
        required: true,
        label: '# Files',
        align: 'right',
        classes: 'kk-num',
        headerClasses: 'kk-num',
        field: (row: FlatMissionDto) => row.filesCount,
        format: (value: number) => value.toString(),
        sortable: true,
    },
    {
        name: 'creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: FlatMissionDto) => row.creator.name,
        format: (value: number) => value.toString(),
        style: 'min-width: 100px',
        sortable: true,
    },
    {
        name: 'createdAt',
        required: true,
        label: 'Creation Date',
        align: 'left',
        field: (row: FlatMissionDto) => row.createdAt,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'missingMetadata',
        required: true,
        label: 'Metadata Verification',
        align: 'left',
        style: 'min-width: 180px',
        sortable: true,
    },

    {
        name: 'size',
        required: true,
        label: 'Size',
        align: 'right',
        classes: 'kk-num',
        headerClasses: 'kk-num',
        field: (row: FlatMissionDto) => row.size,
        format: formatSize,
        sortable: true,
    },

    {
        name: 'missionaction',
        configurable: false,
        label: '',
        style: 'width: 10px',
        align: 'center',
    },
];

function formatMetadataValue(
    value: MetadataDto['value'],
    datatype: DataType,
): string {
    switch (datatype) {
        case DataType.DATE: {
            return formatDate(new Date(value as string));
        }
        case DataType.BOOLEAN: {
            return value ? 'Yes' : 'No';
        }
        default: {
            return String(value);
        }
    }
}

/**
 * An optional missions-table column showing the value of one metadata type.
 *
 * Keyed by the type's name rather than its uuid: several types can share a
 * name, and a column like "location" should mean the same thing in every
 * project. Not sortable, as missions are paged on the server, which cannot
 * order by metadata values yet.
 */
export function missionMetadataColumn(
    metadataType: MetadataTypeDto,
): ProjectColumnType {
    const isNumber = metadataType.datatype === DataType.NUMBER;
    return {
        name: `metadata:${metadataType.name}`,
        label: metadataType.name,
        align: isNumber ? 'right' : 'left',
        ...(isNumber ? { classes: 'kk-num', headerClasses: 'kk-num' } : {}),
        group: 'Metadata',
        defaultHidden: true,
        metadataType,
        field: (row: FlatMissionDto) => {
            const metadata = row.metadata.find(
                (candidate) => candidate.type.name === metadataType.name,
            );
            return metadata
                ? formatMetadataValue(metadata.value, metadata.type.datatype)
                : '';
        },
    };
}

export const fileColumns: ProjectColumnType[] = [
    {
        name: 'state',
        required: true,
        label: 'Health',
        style: 'width: 100px',
        align: 'center',
        sortable: true,
    },
    {
        name: 'filename',
        alwaysVisible: true,
        required: true,
        label: 'File',
        align: 'left',
        field: (row: FileWithTopicDto) => row.filename,
        format: (value: string) => value,
        sortable: true,
    },
    {
        name: 'cats',
        required: false,
        label: 'Categories',
        align: 'right',
    },
    {
        name: 'createdAt',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: FileWithTopicDto) => row.date,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'size',
        required: true,
        label: 'Size',
        align: 'right',
        classes: 'kk-num',
        headerClasses: 'kk-num',
        field: (row: FileWithTopicDto) => row.size,
        format: formatSize,
        sort: (
            _a: string,
            _b: string,
            a: FileWithTopicDto,
            b: FileWithTopicDto,
        ) => a.size - b.size,
        style: 'width: 40px',
        sortable: true,
    },
    {
        name: 'fileaction',
        configurable: false,
        required: true,
        label: '',
        style: 'width: 10px',
        align: 'center',
    },
];
