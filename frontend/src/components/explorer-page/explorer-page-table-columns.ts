import { formatDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import { FlatMissionDto } from '@api/types/mission/mission.dto';
import { FileWithTopicDto } from '@api/types/file/file.dto';

import { ProjectWithMissionCountDto } from '@api/types/project/project-with-mission-count.dto';
import { ProjectWithAccessRightsDto } from '@api/types/project/project-access.dto';

export interface ProjectColumnType {
    name: string;
    required?: boolean;
    label: string;
    align: string;
    field?:
        | ((row: ProjectWithMissionCountDto) => any)
        | ((row: ProjectWithAccessRightsDto) => any)
        | ((row: FlatMissionDto) => any)
        | ((row: FileWithTopicDto) => any);
    format?: ((value: string) => string) | ((value: number) => string);
    sortable?: boolean;
    style?: string;
    sort?: (
        _a: string,
        _b: string,
        a: FileWithTopicDto,
        b: FileWithTopicDto,
    ) => number;
}

export const explorerPageTableColumns: ProjectColumnType[] = [
    {
        name: 'name',
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
        style: 'min-width: 100px',
        field: (row: ProjectWithMissionCountDto) => row.missionCount,
        format: (value: number) => value.toString(),
    },
    {
        name: 'project-action',
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
        label: '',
        style: 'width: 10px',
        align: 'center',
    },
];

export const missionColumns: ProjectColumnType[] = [
    {
        name: 'name',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: FlatMissionDto) => row.name,
        format: (value: string) => value,
    },
    {
        name: 'NrOfFiles',
        required: true,
        label: '# Files',
        align: 'left',
        field: (row: FlatMissionDto) => row.filesCount,
        format: (value: number) => value.toString(),
    },
    {
        name: 'creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: FlatMissionDto) => row.creator.name,
        format: (value: number) => value.toString(),
        style: 'min-width: 100px',
        sortable: false,
    },
    {
        name: 'Created',
        required: true,
        label: 'Creation Date',
        align: 'left',
        field: (row: FlatMissionDto) => row.createdAt,
        format: (value: string) => formatDate(new Date(value)),
    },
    {
        name: 'tagverification',
        required: true,
        label: 'Metadata Verification',
        align: 'left',
        style: 'min-width: 180px',
    },

    {
        name: 'Size',
        required: true,
        label: 'Size',
        align: 'left',
        field: (row: FlatMissionDto) => row.size,
        format: formatSize,
    },

    {
        name: 'missionaction',
        label: '',
        style: 'width: 10px',
        align: 'center',
    },
];

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
        align: 'left',
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
        required: true,
        label: '',
        style: 'width: 10px',
        align: 'center',
    },
];
