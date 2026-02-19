<template>
    <q-table
        v-model:pagination="pagination"
        flat
        bordered
        :rows="apiKeys"
        :columns="columns"
        row-key="uuid"
        wrap-cells
        separator="none"
        :rows-per-page-options="[10, 20, 50]"
        :loading="isLoading"
        @request="onRequest"
    >
        <template #no-data>
            <div
                class="flex flex-center"
                style="justify-content: center; margin: auto"
            >
                <div
                    class="q-pa-md flex flex-center column q-gutter-md"
                    style="min-height: 200px"
                >
                    <span class="text-subtitle1"> No API Tokens Found </span>
                </div>
            </div>
        </template>

        <template #body-cell-missionName="props">
            <q-td :props="props">
                <router-link
                    v-if="props.row.missionUuid && props.row.projectUuid"
                    :to="{
                        name: ROUTES.FILES.routeName,
                        params: {
                            projectUuid: props.row.projectUuid,
                            missionUuid: props.row.missionUuid,
                        },
                    }"
                    class="text-primary"
                >
                    {{ props.row.missionName }}
                </router-link>
                <span v-else>{{ props.value }}</span>
            </q-td>
        </template>

        <template #body-cell-actionTemplateName="props">
            <q-td :props="props">
                <router-link
                    v-if="props.row.actionUuid"
                    :to="{
                        name: ROUTES.ANALYSIS_DETAILS.routeName,
                        params: { id: props.row.actionUuid },
                    }"
                    class="text-primary"
                >
                    {{
                        props.row.actionTemplateVersion
                            ? `${props.row.actionTemplateName} v${props.row.actionTemplateVersion}`
                            : props.row.actionTemplateName || '—'
                    }}
                </router-link>
                <span v-else>—</span>
            </q-td>
        </template>

        <template #body-cell-deletedAt="props">
            <q-td :props="props">
                <q-badge
                    :color="props.row.expired ? 'negative' : 'positive'"
                    :label="props.row.expired ? 'Expired' : 'Active'"
                />
            </q-td>
        </template>
        <template #loading>
            <q-inner-loading showing color="primary" />
        </template>
    </q-table>
</template>

<script setup lang="ts">
import type { ApiKeyMetadataDto } from '@kleinkram/api-dto/types/user/api-key-metadata.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import type { QTableColumn } from 'quasar';
import { useMyApiKeys } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { formatDate } from 'src/services/date-formating';
import { QueryURLHandler } from 'src/services/query-handler';
import { computed, reactive } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const queryHandler = reactive(
    new QueryURLHandler(router, undefined, undefined, 'createdAt', true),
);

const { data: rawData, isLoading } = useMyApiKeys(
    computed(() => queryHandler.take),
    computed(() => queryHandler.skip),
    computed(() => queryHandler.sortBy),
    computed(() => queryHandler.descending),
);

const apiKeys = computed(() => (rawData.value ? rawData.value.data : []));
const rowsNumber = computed(() => (rawData.value ? rawData.value.count : 0));

const pagination = computed({
    get: () => ({
        sortBy: queryHandler.sortBy,
        descending: queryHandler.descending,
        page: queryHandler.page,
        rowsPerPage: queryHandler.take,
        rowsNumber: rowsNumber.value,
    }),
    set: (value) => ({
        sortBy: value.sortBy,
        descending: value.descending,
        page: value.page,
        rowsPerPage: value.rowsPerPage,
        rowsNumber: rowsNumber.value,
    }),
});

interface TableRequestProperties {
    pagination: {
        page: number;
        rowsPerPage: number;
        sortBy: string;
        descending: boolean;
    };
}

function onRequest(props: unknown) {
    const { page, rowsPerPage, sortBy, descending } = (
        props as TableRequestProperties
    ).pagination;
    queryHandler.setPage(page);
    queryHandler.setTake(rowsPerPage);
    queryHandler.setSort(sortBy);
    queryHandler.setDescending(descending);
}

const rightsLabel = (rights: AccessGroupRights): string => {
    switch (rights) {
        case AccessGroupRights.READ: {
            return 'Read';
        }
        case AccessGroupRights.CREATE: {
            return 'Create';
        }
        case AccessGroupRights.WRITE: {
            return 'Write';
        }
        case AccessGroupRights.DELETE: {
            return 'Delete';
        }
        default: {
            return String(rights);
        }
    }
};

const columns: QTableColumn<ApiKeyMetadataDto>[] = [
    {
        name: 'keyType',
        required: true,
        label: 'Type',
        align: 'left',
        field: (row) => row.keyType,
        format: (value: string) => value,
        sortable: true,
        style: 'width: 100px',
    },
    {
        name: 'rights',
        required: true,
        label: 'Rights',
        align: 'left',
        field: (row) => row.rights,
        format: (value: AccessGroupRights) => rightsLabel(value),
        sortable: true,
        style: 'width: 100px',
    },
    {
        name: 'missionName',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row) => row.missionName ?? '—',
        format: (value: string) => value,
    },
    {
        name: 'actionTemplateName',
        required: true,
        label: 'Action',
        align: 'left',
        field: (row) => row.actionTemplateName,
        format: (value: string) => value || '—',
    },
    {
        name: 'deletedAt',
        required: true,
        label: 'Status',
        align: 'center',
        field: (row) => row.expired,
        sortable: true,
        style: 'width: 100px',
    },
    {
        name: 'createdAt',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row) => row.createdAt,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
];
</script>
