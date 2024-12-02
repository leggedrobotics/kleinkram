<template>
    <div>
        <h3>Bull Queue</h3>
        <q-table v-if="data" :columns="cols as any" :rows="data">
            <template #body-cell-kill="props">
                <q-td :props="props">
                    <q-btn
                        color="negative"
                        @click="() => mutate(props.row.job.id)"
                    >
                        Kill
                    </q-btn>
                </q-td>
            </template>
        </q-table>
    </div>
</template>
<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { bullQueue } from 'src/services/queries/queue';
import { Notify } from 'quasar';
import { stopQueue } from 'src/services/mutations/queue';

const { data } = useQuery({
    queryKey: ['bullQueue'],
    queryFn: async () => await bullQueue(),
    refetchInterval: 500,
});
const queryClient = useQueryClient();
const cols = [
    {
        name: 'name',
        label: 'Job Name',
        align: 'left',
        field: (row: any) => row.job.name,
    },
    {
        name: 'action',
        label: 'Action Name',
        align: 'left',
        field: (row: any) =>
            `${row.action.template.name} v${row.action.template.version}`,
    },
    {
        name: 'id',
        label: 'ID',
        align: 'left',
        field: (row: any) => row.job.id,
    },
    {
        name: 'progress',
        label: 'Progress',
        align: 'left',
        field: (row: any) => row.job.progress,
    },
    {
        name: 'timestamp',
        label: 'Timestamp',
        align: 'left',
        field: (row: any) => new Date(row.job.timestamp).toLocaleString(),
    },
    {
        name: 'state',
        label: 'State',
        align: 'left',
        field: (row: any) => row.job.state,
    },
    {
        name: 'kill',
        label: 'Kill',
        align: 'left',
    },
];

const { mutate } = useMutation({
    onMutate: async (jobId: string) => stopQueue(jobId),
    onError: () => {
        Notify.create({
            message: 'Failed to kill job',
            color: 'negative',
            position: 'bottom',
        });
    },
    onSettled: async () => {
        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'bullQueue',
        });
    },
});
</script>
<style scoped></style>
