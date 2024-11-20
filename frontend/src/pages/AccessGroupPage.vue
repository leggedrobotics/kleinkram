<template>
    <title-section :title="'Group: ' + accessGroup?.name">
        <template #tabs>
            <q-tabs
                v-model="tab"
                align="left"
                active-color="primary"
                dense
                class="text-grey"
            >
                <q-tab
                    name="members"
                    label="Members"
                    :disable="personal"
                    style="color: #222"
                >
                    <q-tooltip v-if="personal">
                        Personal Access groups have only the trivial member
                    </q-tooltip>
                </q-tab>
                <q-tab name="projects" label="Projects" style="color: #222" />
            </q-tabs>
        </template>
    </title-section>

    <q-tab-panels v-model="tab" class="q-mt-lg" style="background: transparent">
        <q-tab-panel name="projects">
            <div class="flex justify-between items-center q-mb-lg">
                <div />
                <button-group>
                    <q-input
                        v-model="search"
                        outlined
                        dense
                        placeholder="Search"
                        class="q-mr-sm full-height"
                    >
                        <template #append>
                            <q-icon name="sym_o_search" />
                        </template>
                    </q-input>
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        color="icon-secondary"
                        class="button-border"
                        icon="sym_o_loop"
                        @click="() => refetch()"
                    >
                        <q-tooltip> Refetch the Data</q-tooltip>
                    </q-btn>
                    <q-btn
                        flat
                        class="bg-button-secondary text-on-color"
                        label="Add Project"
                        icon="sym_o_add"
                        @click="openAddProject"
                    />
                </button-group>
            </div>

            <q-table
                ref="tableRef"
                v-model:pagination="pagination"
                v-model:selected="selectedProjects"
                flat
                bordered
                separator="none"
                :rows="project_rows"
                :columns="project_cols"
                selection="multiple"
                row-key="uuid"
                :filter="search"
            >
                <template #body-selection="props">
                    <q-checkbox
                        v-model="props.selected"
                        color="grey-8"
                        class="checkbox-with-hitbox"
                    />
                </template>
                <template #body-cell-projectaction="props">
                    <q-td :props="props">
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_more_vert"
                            unelevated
                            color="primary"
                            class="cursor-pointer"
                            @click.stop
                        >
                            <q-menu auto-close>
                                <q-list>
                                    <q-item
                                        v-ripple
                                        style="width: 180px"
                                        clickable
                                        @click="() => _rowClick(props.row.uuid)"
                                    >
                                        <q-item-section>
                                            View Project Details
                                        </q-item-section>
                                    </q-item>

                                    <ChangeProjectRightsDialogOpener
                                        :project-u-u-i-d="props.row.uuid"
                                        :project-access-u-u-i-d="
                                            props.row.project_access_uuid
                                        "
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Change rights
                                            </q-item-section>
                                        </q-item>
                                    </ChangeProjectRightsDialogOpener>
                                    <RemoveProjectDialogOpener
                                        :access-group="accessGroup"
                                        :project-u-u-i-d="props.row.uuid"
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Remove
                                            </q-item-section>
                                        </q-item>
                                    </RemoveProjectDialogOpener>
                                </q-list>
                            </q-menu>
                        </q-btn>
                    </q-td>
                </template>
            </q-table>
        </q-tab-panel>
        <q-tab-panel name="members">
            <div class="flex justify-between items-center q-mb-lg">
                <div />
                <button-group>
                    <q-input
                        v-model="search"
                        outlined
                        dense
                        placeholder="Search"
                        class="q-mr-sm full-height"
                    >
                        <template #append>
                            <q-icon name="sym_o_search" />
                        </template>
                    </q-input>
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        color="icon-secondary"
                        class="button-border"
                        icon="sym_o_loop"
                        @click="() => refetch()"
                    >
                        <q-tooltip> Refetch the Data</q-tooltip>
                    </q-btn>

                    <AddUserDialogOpener
                        v-if="accessGroup"
                        :access-group="accessGroup"
                    >
                        <q-btn
                            flat
                            class="bg-button-secondary text-on-color full-height"
                            label="Add User"
                            icon="sym_o_add"
                        />
                    </AddUserDialogOpener>
                </button-group>
            </div>
            <q-table
                v-model:pagination="pagination2"
                v-model:selected="selectedUsers"
                :rows="accessGroup?.memberships || []"
                :columns="user_cols"
                style="margin-top: 8px"
                selection="multiple"
                row-key="uuid"
                :filter="search"
            >
                <template #body-selection="props">
                    <q-checkbox
                        v-model="props.selected"
                        color="grey-8"
                        class="checkbox-with-hitbox"
                    />
                </template>
                <template #body-cell-expiration="props">
                    <td>
                        <q-btn
                            flat
                            class="button-border"
                            :label="
                                props.row.expirationDate
                                    ? formatDate(props.row.expirationDate)
                                    : 'Never'
                            "
                            icon="sym_o_date_range"
                            :color="
                                isExpired(props.row.expirationDate)
                                    ? 'negative'
                                    : 'primary'
                            "
                            @click="openSetExpirationDialog(props.row)"
                        />
                    </td>
                </template>
                <template #body-cell-actions="props">
                    <q-td :props="props">
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_more_vert"
                            unelevated
                            color="primary"
                            class="cursor-pointer"
                            @click.stop
                        >
                            <q-menu auto-close>
                                <q-list>
                                    <q-item
                                        v-ripple
                                        style="width: 180px"
                                        clickable
                                        disable
                                    >
                                        <q-item-section>
                                            View Details
                                        </q-item-section>
                                        <q-tooltip>
                                            You can't view details of a user!
                                        </q-tooltip>
                                    </q-item>

                                    <q-item v-ripple clickable disabled>
                                        <q-item-section>Edit</q-item-section>
                                        <q-tooltip>
                                            You can't edit a user!
                                        </q-tooltip>
                                    </q-item>
                                    <q-item
                                        v-ripple
                                        clickable
                                        @click="
                                            () =>
                                                _removeUser(props.row.user.uuid)
                                        "
                                    >
                                        <q-item-section>Remove</q-item-section>
                                    </q-item>
                                </q-list>
                            </q-menu>
                        </q-btn>
                    </q-td>
                </template>
            </q-table>
        </q-tab-panel>
    </q-tab-panels>
</template>
<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { getAccessGroup } from 'src/services/queries/access';
import { useRouter } from 'vue-router';
import { computed, ComputedRef, ref, watch } from 'vue';
import { explorerPageTableColumns } from 'components/explorer_page/explorer_page_table_columns';
import { ProjectAccess } from 'src/types/ProjectAccess';
import { Notify, QTable, useQuasar } from 'quasar';
import AddProjectToAccessGroupDialog from 'src/dialogs/AddProjectToAccessGroupDialog.vue';
import TitleSection from 'components/TitleSection.vue';
import ButtonGroup from 'components/ButtonGroup.vue';
import {
    removeUserFromAccessGroup,
    setAccessGroupExpiry,
} from 'src/services/mutations/access';
import ROUTES from 'src/router/routes';
import RemoveProjectDialogOpener from 'components/buttonWrapper/RemoveProjectDialogOpener.vue';
import ChangeProjectRightsDialogOpener from 'components/buttonWrapper/ChangeProjectRightsDialogOpener.vue';
import AddUserDialogOpener from 'components/buttonWrapper/AddUserDialogOpener.vue';
import { GroupMembership } from 'src/types/AccessGroupUser';
import { formatDate } from 'src/services/dateFormating';
import SetAccessGroupExpirationDialog from 'src/dialogs/SetAccessGroupExpirationDialog.vue';
import { AccessGroupRights } from '@common/enum';

const $q = useQuasar();
const router = useRouter();
const tab = ref('members');
const uuid: ComputedRef<string> = computed(
    () => router.currentRoute.value.params.uuid,
) as ComputedRef<string>;
const selectedProjects = ref([]);
const selectedUsers = ref([]);

const search = ref('');

const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 30,
});

const pagination2 = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 30,
});

const queryClient = useQueryClient();

const { data: accessGroup, refetch } = useQuery({
    queryKey: ['AccessGroup', uuid],
    queryFn: async () => {
        return getAccessGroup(uuid.value);
    },
});

function isExpired(date: Date | null) {
    if (!date) {
        return false;
    }
    return date < new Date();
}

const { mutate: _removeUser } = useMutation({
    mutationFn: (userUUID: string) =>
        removeUserFromAccessGroup(userUUID, uuid.value),
    onSuccess: () => {
        await queryClient.invalidateQueries({
            queryKey: ['AccessGroup', uuid],
        });
        Notify.create({
            message: 'User removed from access group',
            color: 'positive',
            position: 'bottom',
        });
    },
    onError: () => {
        Notify.create({
            message: 'Error removing user from access group',
            color: 'negative',
            position: 'bottom',
        });
    },
});
const personal = computed(() => accessGroup.value?.personal);

watch(
    () => personal.value,
    (value) => {
        if (value) {
            tab.value = 'projects';
        }
    },
    { immediate: true },
);

const project_rows = computed(() => {
    console.log(accessGroup.value);
    return accessGroup.value?.projectAccesses.map((project: ProjectAccess) => {
        return {
            ...project.project,
            rights: project.rights,
            project_access_uuid: project.uuid,
        };
    });
});

function openAddProject() {
    $q.dialog({
        component: AddProjectToAccessGroupDialog,
        componentProps: {
            access_group_uuid: uuid.value,
        },
    });
}

const rename_columns = (cols: any[], old_label: string, new_label: string) => {
    cols.filter((col) => col.label === old_label).forEach((col) => {
        col.label = new_label;
    });
};

const drop_columns = (cols: any[], label: string) => {
    return cols.filter((col) => col.label !== label);
};

const { mutate: setAccessGroup } = useMutation({
    mutationFn: (data: { aguUUID: string; expirationDate: Date | null }) => {
        return setAccessGroupExpiry(data.aguUUID, data.expirationDate);
    },
    onSuccess: () => {
        await queryClient.invalidateQueries({
            predicate: (query) => {
                return (
                    query.queryKey[0] === 'AccessGroup' &&
                    query.queryKey[1] === uuid.value
                );
            },
        });
        Notify.create({
            message: 'Expiration date set',
            color: 'positive',
            position: 'bottom',
        });
    },
    onError: () => {
        Notify.create({
            message: 'Error setting expiration date',
            color: 'negative',
            position: 'bottom',
        });
    },
});

function openSetExpirationDialog(agu: GroupMembership) {
    $q.dialog({
        component: SetAccessGroupExpirationDialog,
        componentProps: {
            agu: agu,
        },
    }).onOk((expirationDate: Date | null) => {
        setAccessGroup({
            aguUUID: agu.uuid,
            expirationDate,
        });
    });
}

const project_cols = computed(() => {
    {
        let defaultCols = [...explorerPageTableColumns];
        rename_columns(defaultCols, 'Creator', 'Project Creator');
        rename_columns(defaultCols, 'Description', 'Project Description');
        defaultCols = drop_columns(defaultCols, 'Created');

        // add as the second to last column
        defaultCols.splice(defaultCols.length - 2, 1, {
            name: 'rights',
            required: true,
            label: 'Group Rights',
            style: 'max-width: 100px',
            align: 'left',
            field: (row: any) => AccessGroupRights[row.rights],
        });
        return defaultCols;
    }
});
const user_cols = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: (row: GroupMembership) => row.user?.name,
        format: (val: string) => `${val}`,
        style: 'width: 10%',
    },
    {
        name: 'email',
        required: true,
        label: 'Email',
        align: 'left',
        field: (row: GroupMembership) => row.user?.email,
    },
    {
        name: 'expiration',
        required: true,
        label: 'Expiration',
        align: 'left',
    },
    {
        name: 'actions',
        required: true,
        label: '',
        align: 'center',
        field: 'actions',
        style: 'width: 5%',
    },
];

const _rowClick = (_uuid: string) => {
    await router?.push({
        name: ROUTES.MISSIONS.routeName,
        params: {
            project_uuid: _uuid,
        },
    });
};
</script>
<style scoped></style>
