<template>
    <q-table
        v-model:pagination="pagination"
        flat
        :bordered="!$q.screen.xs"
        :rows="apiKeys"
        :columns="columns"
        :visible-columns="visibleColumns"
        row-key="uuid"
        wrap-cells
        separator="none"
        :grid="$q.screen.xs"
        :rows-per-page-options="[10, 20, 50]"
        :loading="isLoading"
        class="api-key-table"
        @request="onRequest"
    >
        <template #item="props">
            <div class="col-12 q-pb-sm">
                <q-card flat bordered>
                    <q-card-section>
                        <div class="row no-wrap items-center justify-between">
                            <span class="text-weight-medium api-key-card__type">
                                {{ props.row.keyType }}
                            </span>
                            <q-badge
                                :color="
                                    props.row.expired ? 'negative' : 'positive'
                                "
                                :label="
                                    props.row.expired ? 'Expired' : 'Active'
                                "
                            />
                        </div>

                        <div class="api-key-card__row">
                            <span class="api-key-card__label">Rights</span>
                            <span>{{ rightsLabel(props.row.rights) }}</span>
                        </div>

                        <div class="api-key-card__row">
                            <span class="api-key-card__label">Mission</span>
                            <router-link
                                v-if="
                                    props.row.missionUuid &&
                                    props.row.projectUuid
                                "
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
                            <span v-else>{{
                                props.row.missionName ?? '—'
                            }}</span>
                        </div>

                        <div class="api-key-card__row">
                            <span class="api-key-card__label">Action</span>
                            <router-link
                                v-if="props.row.actionUuid"
                                :to="{
                                    name: ROUTES.ANALYSIS_DETAILS.routeName,
                                    params: { id: props.row.actionUuid },
                                }"
                                class="text-primary"
                            >
                                {{ actionLabel(props.row) }}
                            </router-link>
                            <span v-else>—</span>
                        </div>

                        <div class="api-key-card__row">
                            <span class="api-key-card__label">Created</span>
                            <span>{{ createdLabel(props.row) }}</span>
                        </div>
                    </q-card-section>
                </q-card>
            </div>
        </template>

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
                    {{ actionLabel(props.row) }}
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
import { useQuasar } from 'quasar';
import { useMyApiKeys } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { formatDate } from 'src/services/date-formating';
import { QueryURLHandler } from 'src/services/query-handler';
import { computed, reactive } from 'vue';
import { useRouter } from 'vue-router';

const $q = useQuasar();
const router = useRouter();

/**
 * On phones the table is rendered as a card list (see the `#item` slot); on
 * small screens the least important columns are dropped so that the table
 * fits without horizontal scrolling.
 */
const visibleColumns = computed<string[] | undefined>(() =>
    $q.screen.lt.md
        ? ['key_type', 'rights', 'missionName', 'deletedAt']
        : undefined,
);

const actionLabel = (row: ApiKeyMetadataDto): string => {
    const name = row.actionTemplateName ?? '';
    if (name === '') return '—';
    return row.actionTemplateVersion === undefined
        ? name
        : `${name} v${String(row.actionTemplateVersion)}`;
};

const createdLabel = (row: ApiKeyMetadataDto): string =>
    formatDate(new Date(row.createdAt));
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
    set: (value) => {
        queryHandler.setPage(value.page);
        queryHandler.setTake(value.rowsPerPage);
        queryHandler.setSort(value.sortBy);
        queryHandler.setDescending(value.descending);
    },
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
        name: 'key_type',
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
        label: 'Created',
        align: 'left',
        field: (row) => row.createdAt,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
];
</script>

<style scoped>
.api-key-card__type {
    overflow-wrap: anywhere;
}

.api-key-card__row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 6px;
    font-size: 13px;
    overflow-wrap: anywhere;
}

.api-key-card__label {
    color: #58585c;
    flex: 0 0 auto;
}

@media (max-width: 599px) {
    /* The pagination controls must wrap instead of overflowing the page */
    .api-key-table :deep(.q-table__bottom) {
        flex-wrap: wrap;
        row-gap: 4px;
    }

    .api-key-table :deep(.q-table__grid-content) {
        margin: 0;
    }
}
</style>
