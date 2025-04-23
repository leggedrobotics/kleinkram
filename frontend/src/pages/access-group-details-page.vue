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
                        @click="refetchOnClick"
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
                :rows="projectRows"
                :columns="projectCols as any"
                selection="multiple"
                row-key="uuid"
                :filter="search"
                binary-state-sort
            >
                <template #body-selection="props">
                    <q-checkbox
                        v-model="props.selected"
                        color="grey-8"
                        class="checkbox-with-hitbox"
                    />
                </template>
                <template #body-cell-project-action="props">
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
                                        @click="() => rowClick(props.row.uuid)"
                                    >
                                        <q-item-section>
                                            View Project Details
                                        </q-item-section>
                                    </q-item>

                                    <change-project-rights-dialog-opener
                                        :project-uuid="props.row.uuid"
                                        :project-access-uuid="
                                            props.row.project_access_uuid
                                        "
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Change rights
                                            </q-item-section>
                                        </q-item>
                                    </change-project-rights-dialog-opener>
                                    <RemoveProjectDialogOpener
                                        v-if="accessGroup"
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
                        @click="refetchOnClick"
                    >
                        <q-tooltip> Refetch the Data</q-tooltip>
                    </q-btn>

                    <DialogOpenerAddUser
                        v-if="accessGroup"
                        :access-group="accessGroup"
                    >
                        <q-btn
                            flat
                            class="bg-button-secondary text-on-color full-height"
                            label="Add User"
                            icon="sym_o_add"
                        />
                    </DialogOpenerAddUser>
                </button-group>
            </div>
            <q-table
                v-model:pagination="pagination2"
                v-model:selected="selectedUsers"
                :rows="accessGroup?.memberships || []"
                :columns="userCols as any"
                style="margin-top: 8px"
                selection="multiple"
                row-key="uuid"
                :filter="search"
                binary-state-sort
                flat
                bordered
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
                                    ? props.row.expirationDate.toDateString()
                                    : 'Never'
                            "
                            icon="sym_o_date_range"
                            :color="
                                isExpired(props.row.expirationDate)
                                    ? 'negative'
                                    : 'primary'
                            "
                            :disable="!currentUserCanEdit"
                            @click="() => openSetExpirationDialog(props.row)"
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
                                        :disable="!currentUserCanEdit"
                                        @click="
                                            () =>
                                                removeUser(props.row.user.uuid)
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
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useRouter } from 'vue-router';
import { computed, ComputedRef, ref, watch } from 'vue';
import { Notify, QTable, useQuasar } from 'quasar';
import AddProjectToAccessGroupDialog from 'src/dialogs/add-project-access-group-dialog.vue';
import {
    removeUserFromAccessGroup,
    setAccessGroupExpiry,
} from 'src/services/mutations/access';
import ROUTES from 'src/router/routes';
import SetAccessGroupExpirationDialog from 'src/dialogs/modify-membership-expiration-date-dialog.vue';
import { AccessGroupRights, AccessGroupType } from '@common/enum';
import { GroupMembershipDto } from '@api/types/user.dto';
import { useAccessGroup, useUser } from 'src/hooks/query-hooks';
import ChangeProjectRightsDialogOpener from 'components/button-wrapper/dialog-opener-change-project-rights.vue';
import TitleSection from 'components/title-section.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import RemoveProjectDialogOpener from 'components/button-wrapper/remove-project-dialog-opener.vue';
import { projectAccessColumns } from 'components/explorer-page/explorer-page-table-columns';
import DialogOpenerAddUser from 'components/button-wrapper/dialog-opener-add-user.vue';

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
const user = useUser();

const refetchOnClick: (event_: Event) => void = () => refetch;

const { data: accessGroup, refetch } = useAccessGroup(uuid.value);

function isExpired(date: Date | null): boolean {
    if (!date) {
        return false;
    }
    return date < new Date();
}

const { mutate: removeUser } = useMutation({
    mutationFn: (userUUID: string) =>
        removeUserFromAccessGroup(userUUID, uuid.value),
    onSuccess: async () => {
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
const personal = computed(
    () => accessGroup.value?.type === AccessGroupType.PRIMARY,
);

watch(
    () => personal.value,
    (value) => {
        if (value) {
            tab.value = 'projects';
        }
    },
    { immediate: true },
);

const projectRows = computed(() => {
    return accessGroup.value?.projectAccesses ?? [];
});

const openAddProject = (): void => {
    $q.dialog({
        component: AddProjectToAccessGroupDialog,
        componentProps: {
            accessGroupUuid: uuid.value,
        },
    });
};

const renameColumns = (
    cols: any[],
    oldLabel: string,
    newLabel: string,
): void => {
    for (const col of cols.filter((c) => c.label === oldLabel)) {
        col.label = newLabel;
    }
};

const dropColumns = (cols: any[], label: string) => {
    return cols.filter((col) => col.label !== label);
};

const { mutate: setAccessGroup } = useMutation({
    mutationFn: (data: {
        uuid: string;
        userUuid: string;
        expirationDate: Date | null;
    }) => {
        return setAccessGroupExpiry(
            data.uuid,
            data.userUuid,
            data.expirationDate,
        );
    },
    onSuccess: async () => {
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

const openSetExpirationDialog = (agu: GroupMembershipDto): void => {
    $q.dialog({
        component: SetAccessGroupExpirationDialog,
        componentProps: {
            agu: agu,
        },
    }).onOk((expirationDate: Date | null) => {
        setAccessGroup({
            uuid: accessGroup.value?.uuid ?? '',
            userUuid: agu.user.uuid,
            expirationDate,
        });
    });
};

const projectCols = computed(() => {
    {
        let defaultCols = [...projectAccessColumns];
        renameColumns(defaultCols, 'Creator', 'Project Creator');
        renameColumns(defaultCols, 'Description', 'Project Description');
        defaultCols = dropColumns(defaultCols, 'Created');

        // add as the second to last column
        defaultCols.splice(-2, 1, {
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

const currentUserCanEdit = computed(() => {
    return (
        accessGroup.value?.memberships.some(
            (m) => m.user.uuid === user.data.value?.uuid && m.canEditGroup,
        ) ?? false
    );
});

const userCols = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: (row: GroupMembershipDto): string => row.user.name,
        format: (value: string): string => value,
        style: 'width: 10%',
    },
    {
        name: 'expiration',
        required: true,
        label: 'Expiration',
        align: 'left',
    },
    {
        name: 'canEdit',
        required: true,
        label: 'Can Edit Group',
        align: 'right',
        field: (row: GroupMembershipDto): string =>
            row.canEditGroup ? 'Yes' : 'No',
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

const rowClick = async (_uuid: string): Promise<void> => {
    await router.push({
        name: ROUTES.MISSIONS.routeName,
        params: {
            projectUuid: _uuid,
        },
    });
};
</script>
<style scoped></style>
