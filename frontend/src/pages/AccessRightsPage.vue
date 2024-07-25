<template>
    <q-page class="flex">
        <div class="q-pa-md">
            <div class="text-h4">Access Rights</div>
            <p>
                Access Rights allows you to manage the access rights of the
                users and blablabla lorem ipsum dolor sit amet.
            </p>
            <q-table
                ref="tableRef"
                v-model:pagination="pagination"
                title="Projects"
                :rows="data"
                :columns="project_columns"
            >
                <template v-slot:body-cell-projectaction="props">
                    <q-td :props="props">
                        <q-btn
                            color="primary"
                            label="Edit"
                            @click="() => editAccess(props.row)"
                        ></q-btn>
                    </q-td>
                </template>
            </q-table>
        </div>
    </q-page>
</template>
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { allProjects } from 'src/services/queries';
import { ref } from 'vue';
import { formatDate } from 'src/services/dateFormating';
import { Project } from 'src/types/Project';

const { data } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: allProjects,
});

const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 30,
});
const project_columns = [
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
        label: 'Nr of Missions',
        align: 'left',
        field: (row: Project) => row.missions.length,
        format: (val: number) => `${val}`,
        sortable: true,
    },
    {
        name: 'projectaction',
        label: 'Action',
        align: 'center',
    },
];
function editAccess(row: Project) {
    console.log('Edit access for project:', row);
}
</script>

<style scoped></style>
