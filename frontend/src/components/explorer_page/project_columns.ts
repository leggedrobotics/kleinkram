import {Project} from "src/types/Project";
import {formatDate} from "src/services/dateFormating";
import {Mission} from "src/types/Mission";
import {FileEntity} from "src/types/FileEntity";
import {formatSize} from "src/services/generalFormatting";

export type ProjectColumnType = {
    name: string;
    required?: boolean;
    label: string;
    align: string;
    field?: ((row: Project) => any) | ((row: Mission) => any) | ((row: FileEntity) => any);
    format?: ((val: string) => string) | ((val: number) => string);
    sortable?: boolean;
    style?: string;
    sort?: (_a: string, _b: string, a: FileEntity, b: FileEntity) => number;
};


const project_columns: Array<ProjectColumnType> = [
    {
        name: 'Project',
        required: true,
        label: 'Project',
        align: 'left',
        field: (row: Project) => row.name,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  10%; max-width: 10%; min-width: 10%;',
    },
    {
        name: 'Description',
        required: true,
        label: 'Description',
        align: 'left',
        field: (row: Project) => row.description || '',
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  60%; max-width: 60%; min-width: 60%;',
    },

    {
        name: 'Creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: Project) => (row.creator ? row.creator.name : ''),
        format: (val: number) => `${val}`,
        sortable: true,
        style: 'width:  10%; max-width: 10%; min-width: 10%;',
    },
    {
        name: 'Created',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: Project) => row.createdAt,
        format: (val: string) => formatDate(new Date(val)),
        sortable: true,
    },
    {
        name: 'NrOfMissions',
        required: true,
        label: '# Missions',
        align: 'left',
        field: (row: Project) => row.missions.length,
        format: (val: number) => `${val}`,
        sortable: true,
        style: 'width: 120px;',
    },
    {
        name: 'projectaction',
        label: 'Action',
        align: 'center',
    },
];
const mission_columns: Array<ProjectColumnType> = [
    {
        name: 'Mission',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: Mission) => row.name,
        format: (val: string) => `${val}`,
        sortable: true,
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
        field: (row: Mission) => row.files.length,
        format: (val: number) => `${val}`,
        sortable: true,
    },
    {
        name: 'missionaction',
        label: 'Action',
        align: 'center',
    },
];

const file_columns: Array<ProjectColumnType> = [
    {
        name: 'File',
        required: true,
        label: 'File',
        align: 'left',
        field: (row: FileEntity) => row.filename,
        format: (val: string) => `${val}`,
        sortable: true,
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
        sortable: true,
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

export enum DataType {
    PROJECTS = 'projects',
    MISSIONS = 'missions',
    FILES = 'files'
}

export const getColumns = (type: DataType): Array<ProjectColumnType> => {
    switch (type) {
        case DataType.PROJECTS:
            return project_columns;
        case DataType.MISSIONS:
            return mission_columns;
        case DataType.FILES:
            return file_columns;
    }
}