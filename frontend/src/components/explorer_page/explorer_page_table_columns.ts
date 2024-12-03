import { formatDate } from 'src/services/dateFormating';
import { formatSize } from 'src/services/generalFormatting';
import { FileDto } from '@api/types/Files.dto';
import { MissionDto } from '@api/types/Mission.dto';
import { ProjectDto } from '@api/types/Project.dto';

export interface ProjectColumnType {
    name: string;
    required?: boolean;
    label: string;
    align: string;
    field?:
        | ((row: ProjectDto) => any)
        | ((row: MissionDto) => any)
        | ((row: FileDto) => any)
        // @ts-ignore
        | ((row: AggregatedMission) => any);
    format?: ((value: string) => string) | ((value: number) => string);
    sortable?: boolean;
    style?: string;
    sort?: (_a: string, _b: string, a: FileDto, b: FileDto) => number;
}

export const explorerPageTableColumns: ProjectColumnType[] = [
    {
        name: 'name',
        required: true,
        label: 'Project Name',
        align: 'left',
        field: (row: ProjectDto) => row.name,
        format: (value: string) => value,
        sortable: true,
        style: 'width: 140px',
    },
    {
        name: 'description',
        required: true,
        label: 'Description',
        align: 'left',
        field: (row: ProjectDto) => row.description,
        format: (value: string) => value,
        sortable: true,
    },

    {
        name: 'creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: ProjectDto) => row.creator.name,
        format: (value: number) => value.toString(),
        style: 'min-width: 100px',
        sortable: true,
    },
    {
        name: 'createdAt',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: ProjectDto) => row.createdAt,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'nrOfMissions',
        required: true,
        label: '# Missions',
        align: 'right',
        style: 'min-width: 100px',
        field: (row: ProjectDto) => row.missions.length,
        format: (value: number) => value.toString(),
    },
    {
        name: 'projectaction',
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
        field: (row: MissionDto) => row.name,
        format: (value: string) => value,
    },
    {
        name: 'NrOfFiles',
        required: true,
        label: 'Nr of Files',
        align: 'left',
        // @ts-ignore
        field: (row: AggregatedMission) => row.nrFiles,
        format: (value: number) => value.toString(),
    },
    {
        name: 'creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: ProjectDto) => row.creator.name,
        format: (value: number) => value.toString(),
        style: 'min-width: 100px',
        sortable: false,
    },
    {
        name: 'Created',
        required: true,
        label: 'Creation Date',
        align: 'left',
        field: (row: MissionDto) => row.createdAt,
        format: (value: string) => formatDate(new Date(value)),
    },
    {
        name: 'tagverification',
        required: true,
        label: 'Tag Verification',
        align: 'left',
    },
    {
        name: 'Size',
        required: true,
        label: 'Size',
        align: 'left',
        // @ts-ignore
        field: (row: AggregatedMission) => row.size,
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
        field: (row: FileDto) => row.filename,
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
        field: (row: FileDto) => row.date,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'size',
        required: true,
        label: 'Size',
        align: 'left',
        field: (row: FileDto) => row.size,
        format: formatSize,
        sort: (_a: string, _b: string, a: FileDto, b: FileDto) =>
            a.size - b.size,
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
