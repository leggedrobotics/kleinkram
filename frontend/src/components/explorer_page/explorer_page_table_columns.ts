import { Project } from 'src/types/Project';
import { formatDate } from 'src/services/dateFormating';
import { Mission } from 'src/types/Mission';
import { FileEntity } from 'src/types/FileEntity';
import { formatSize } from 'src/services/generalFormatting';

export type ProjectColumnType = {
    name: string;
    required?: boolean;
    label: string;
    align: string;
    field?:
        | ((row: Project) => any)
        | ((row: Mission) => any)
        | ((row: FileEntity) => any);
    format?: ((val: string) => string) | ((val: number) => string);
    sortable?: boolean;
    style?: string;
    sort?: (_a: string, _b: string, a: FileEntity, b: FileEntity) => number;
};

export const explorer_page_table_columns: Array<ProjectColumnType> = [
    {
        name: 'name',
        required: true,
        label: 'Project Name',
        align: 'left',
        field: (row: Project) => row.name,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width: 140px',
    },
    {
        name: 'description',
        required: true,
        label: 'Description',
        align: 'left',
        field: (row: Project) => row.description || '',
        format: (val: string) => `${val}`,
        sortable: true,
    },

    {
        name: 'creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: Project) => (row.creator ? row.creator?.name : ''),
        format: (val: number) => `${val}`,
        style: 'min-width: 100px',
        sortable: true,
    },
    {
        name: 'createdAt',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: Project) => row.createdAt,
        format: (val: string) => formatDate(new Date(val)),
        sortable: true,
    },
    {
        name: 'nrOfMissions',
        required: true,
        label: '# Missions',
        align: 'right',
        style: 'min-width: 100px',
        field: (row: Project) => row.missions?.length,
        format: (val: number) => `${val}`,
    },
    {
        name: 'projectaction',
        label: '',
        align: 'center',
    },
];

export const mission_columns: Array<ProjectColumnType> = [
    {
        name: 'name',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: Mission) => row.name,
        format: (val: string) => `${val}`,
    },
    {
        name: 'Created',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: Mission) => row.createdAt,
        format: (val: string) => formatDate(new Date(val)),
    },
    {
        name: 'NrOfFiles',
        required: true,
        label: 'Nr of Files',
        align: 'left',
        field: (row: Mission) => row.files?.length,
        format: (val: number) => `${val}`,
    },
    {
        name: 'Size',
        required: true,
        label: 'Size',
        align: 'left',
        field: (row: Mission) =>
            row.files?.map((f) => f.size).reduce((a, b) => a + b, 0),
        format: formatSize,
    },
    {
        name: 'missionaction',
        label: 'Action',
        align: 'center',
    },
];

export const file_columns: Array<ProjectColumnType> = [
    {
        name: 'name',
        required: true,
        label: 'File',
        align: 'left',
        field: (row: FileEntity) => row.filename,
        format: (val: string) => `${val}`,
    },
    {
        name: 'Created',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: FileEntity) => row.date,
        format: (val: string) => formatDate(new Date(val)),
    },
    {
        name: 'Size',
        required: true,
        label: 'Size',
        align: 'left',
        field: (row: FileEntity) => row.size,
        format: formatSize,
        sort: (_a: string, _b: string, a: FileEntity, b: FileEntity) =>
            a.size - b.size,
    },
    {
        name: 'fileaction',
        required: true,
        label: 'Action',
        align: 'center',
    },
];
