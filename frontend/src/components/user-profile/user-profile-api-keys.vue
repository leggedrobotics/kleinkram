<template>
    <q-table
        v-if="apiKeys"
        flat
        bordered
        :rows="apiKeys"
        :columns="columns"
        row-key="uuid"
        wrap-cells
        separator="none"
        :rows-per-page-options="[10, 20, 50]"
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

        <template #body-cell-status="props">
            <q-td :props="props">
                <q-badge
                    :color="props.row.expired ? 'negative' : 'positive'"
                    :label="props.row.expired ? 'Expired' : 'Active'"
                />
            </q-td>
        </template>
    </q-table>
    <div v-else>
        <div class="row flex-center">
            <q-spinner-gears size="100px" />
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ApiKeyMetadataDto } from '@kleinkram/api-dto/types/user/api-key-metadata.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import type { QTableColumn } from 'quasar';
import { useMyApiKeys } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { formatDate } from 'src/services/date-formating';

const { data: apiKeys } = useMyApiKeys();

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
        name: 'status',
        required: true,
        label: 'Status',
        align: 'center',
        field: (row) => row.expired,
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
