<template>
    <div>
        <title-section :title="project?.name">
            <template v-if="project?.isPublic || isArchived" #titleAppend>
                <public-project-chip v-if="project?.isPublic" />
                <archived-project-chip
                    v-if="isArchived && project?.archiveState"
                    :state="project.archiveState"
                />
            </template>

            <template
                v-if="project?.description.trim() || showPublicAccessHint"
                #subtitle
            >
                <p
                    v-if="project?.description.trim()"
                    class="text-body2 text-grey-8 q-ma-none"
                >
                    {{ project.description }}
                </p>
                <div
                    v-if="showPublicAccessHint"
                    class="row items-center text-caption text-grey-8"
                    :class="{ 'q-mt-sm': project?.description.trim() }"
                    style="gap: 6px"
                >
                    <q-icon name="sym_o_public" size="16px" color="green-8" />
                    Everyone with a Kleinkram account can view and download this
                    project.
                    <change-project-rights-dialog-opener
                        v-if="projectUuid"
                        :project-uuid="projectUuid"
                        project-access-uuid=""
                    >
                        <a
                            class="text-button-primary text-weight-medium cursor-pointer"
                        >
                            Manage access
                        </a>
                    </change-project-rights-dialog-opener>
                </div>
            </template>

            <template #buttons>
                <button-group>
                    <project-star-button
                        v-if="projectUuid && project"
                        :project-uuid="projectUuid"
                        :starred="project.isStarred"
                        class="button-border"
                        style="height: 100%; min-height: 40px; min-width: 40px"
                    />

                    <ConfigureMetadataTypesDialogOpener
                        v-if="projectUuid && !isReadOnlyPublicView"
                        :project-uuid="projectUuid"
                    >
                        <q-btn
                            class="button-border"
                            flat
                            style="height: 100%; min-height: 40px"
                            color="primary"
                            icon="sym_o_sell"
                            :label="
                                $q.screen.xs ? undefined : 'Enforce Metadata'
                            "
                            aria-label="Enforce Metadata"
                            :disable="!projectUuid"
                        >
                            <q-tooltip v-if="$q.screen.xs">
                                Enforce Metadata
                            </q-tooltip>
                        </q-btn>
                    </ConfigureMetadataTypesDialogOpener>

                    <q-btn
                        icon="sym_o_more_vert"
                        class="button-border"
                        flat
                        style="height: 100%; min-height: 40px; min-width: 40px"
                        color="primary"
                        aria-label="More Actions"
                    >
                        <q-tooltip> More Actions</q-tooltip>

                        <q-menu
                            v-if="projectUuid !== undefined"
                            auto-close
                            style="width: 280px"
                        >
                            <q-list>
                                <change-project-rights-dialog-opener
                                    v-if="!isReadOnlyPublicView"
                                    :project-uuid="projectUuid"
                                    project-access-uuid=""
                                >
                                    <q-item v-close-popup clickable>
                                        <q-item-section avatar>
                                            <q-icon name="sym_o_lock" />
                                        </q-item-section>
                                        <q-item-section>
                                            <q-item-section>
                                                Manage Access
                                            </q-item-section>
                                        </q-item-section>
                                    </q-item>
                                </change-project-rights-dialog-opener>

                                <edit-project-dialog-opener
                                    v-if="!isReadOnlyPublicView"
                                    :project-uuid="projectUuid"
                                >
                                    <q-item v-close-popup clickable>
                                        <q-item-section avatar>
                                            <q-icon name="sym_o_edit" />
                                        </q-item-section>
                                        <q-item-section>
                                            <q-item-section>
                                                Edit Project
                                            </q-item-section>
                                        </q-item-section>
                                    </q-item>
                                </edit-project-dialog-opener>
                                <q-item
                                    v-ripple
                                    clickable
                                    @click="copyProjectUuidToClipboard"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_fingerprint" />
                                    </q-item-section>
                                    <q-item-section> Copy UUID</q-item-section>
                                </q-item>
                                <archive-project-dialog-opener
                                    v-if="canManageArchive && !isArchived"
                                    :project-uuid="projectUuid"
                                >
                                    <q-item v-close-popup clickable>
                                        <q-item-section avatar>
                                            <q-icon name="sym_o_inventory_2" />
                                        </q-item-section>
                                        <q-item-section>
                                            <q-item-label>
                                                Archive to Long Term Storage
                                            </q-item-label>
                                            <q-item-label caption>
                                                Move all files to tape
                                            </q-item-label>
                                        </q-item-section>
                                    </q-item>
                                </archive-project-dialog-opener>
                                <restore-project-dialog-opener
                                    v-if="
                                        canManageArchive &&
                                        project?.archiveState ===
                                            ProjectArchiveState.ARCHIVED
                                    "
                                    :project-uuid="projectUuid"
                                >
                                    <q-item v-close-popup clickable>
                                        <q-item-section avatar>
                                            <q-icon
                                                name="sym_o_settings_backup_restore"
                                            />
                                        </q-item-section>
                                        <q-item-section>
                                            Restore from Archive
                                        </q-item-section>
                                    </q-item>
                                </restore-project-dialog-opener>
                                <DeleteProjectDialogOpener
                                    v-if="!isReadOnly"
                                    :project-uuid="projectUuid ?? ''"
                                    :has-missions="
                                        (project?.missionCount ?? 0) > 0
                                    "
                                >
                                    <q-item
                                        v-ripple
                                        v-close-popup
                                        clickable
                                        style="color: red"
                                    >
                                        <q-item-section avatar>
                                            <q-icon name="sym_o_delete" />
                                        </q-item-section>
                                        <q-item-section>
                                            <q-item-section>
                                                Delete Project
                                            </q-item-section>
                                        </q-item-section>
                                    </q-item>
                                </DeleteProjectDialogOpener>
                            </q-list>
                        </q-menu>
                    </q-btn>
                </button-group>
            </template>
        </title-section>
        <ActionConfiguration
            :open="createAction"
            :mission-uuids="selectedMissionUuids"
            @close="onClose"
        />
        <div>
            <project-archive-banner
                v-if="projectUuid && isArchived"
                :project-uuid="projectUuid"
            />
            <div
                v-if="isReadOnlyPublicView"
                class="row items-center no-wrap q-pa-md public-project-banner"
                :class="$q.screen.xs ? 'q-mt-md' : 'q-mt-lg'"
            >
                <q-icon
                    name="sym_o_public"
                    size="22px"
                    color="green-8"
                    class="q-mr-md"
                />
                <div>
                    <span class="text-weight-bold">
                        This is a public project.
                    </span>
                    You can browse and download all missions, but you cannot
                    upload or change anything.
                </div>
            </div>
            <div
                v-if="selectedMissions.length === 0"
                class="missions-toolbar"
                :class="$q.screen.xs ? 'q-my-md' : 'q-my-lg'"
            >
                <h2 class="text-h4 q-mb-xs missions-toolbar__title">
                    {{ missionsHeading }}
                </h2>

                <div class="missions-toolbar__search">
                    <app-search-bar
                        v-model="search"
                        placeholder="Search by Mission Name"
                    />
                </div>

                <div class="missions-toolbar__actions">
                    <app-refresh-button @click="refresh" />
                    <UploadMissionFolder
                        v-if="!isReadOnly"
                        :project-uuid="projectUuid"
                    >
                        <q-btn
                            flat
                            style="height: 100%; min-height: 40px"
                            color="icon-secondary"
                            class="button-border"
                            icon="sym_o_drive_folder_upload"
                            aria-label="Create Mission from Folder"
                        >
                            <q-tooltip>Create Mission from Folder</q-tooltip>
                        </q-btn>
                    </UploadMissionFolder>
                    <create-mission-dialog-opener
                        v-if="!isReadOnly"
                        :project-uuid="projectUuid"
                    >
                        <app-create-button
                            :label="$q.screen.xs ? 'Create' : 'Create Mission'"
                            aria-label="Create Mission"
                        />
                    </create-mission-dialog-opener>
                </div>
            </div>
            <table-selection-bar
                v-else
                noun="mission"
                class="missions-selection"
                :count="selectedMissions.length"
                @clear="deselect"
            >
                <KleinDownloadMissions
                    v-if="!isArchived"
                    :missions="selectedMissions"
                    class="missions-selection__cli"
                />
                <q-btn
                    v-if="!isArchived"
                    flat
                    dense
                    padding="6px"
                    icon="sym_o_analytics"
                    color="white"
                    @click="openMultiActions"
                >
                    Actions
                </q-btn>

                <q-btn
                    v-if="!isReadOnly"
                    flat
                    dense
                    padding="6px"
                    icon="sym_o_delete"
                    color="white"
                    :disable="
                        selectedMissions.length !== 1 ||
                        (selectedMissions.length === 1 &&
                            (selectedMissions[0]?.filesCount ?? 0) > 0)
                    "
                    @click="deleteMission"
                >
                    Delete
                    <q-tooltip v-if="selectedMissions.length !== 1">
                        You can only delete one mission at a time
                    </q-tooltip>

                    <q-tooltip
                        v-if="
                            selectedMissions.length === 1 &&
                            (selectedMissions[0]?.filesCount ?? 0) > 0
                        "
                    >
                        You cannot delete missions with files
                    </q-tooltip>
                </q-btn>
            </table-selection-bar>

            <div>
                <Suspense>
                    <template #fallback>
                        <div
                            style="width: 100%; max-width: 550px; height: 67px"
                        >
                            <q-skeleton
                                class="q-mr-md q-mb-sm q-mt-sm"
                                style="max-width: 300px; height: 20px"
                            />
                            <q-skeleton
                                class="q-mr-md"
                                style="max-width: 200px; height: 18px"
                            />
                        </div>
                    </template>
                </Suspense>
            </div>
            <div>
                <Suspense>
                    <explorer-page-mission-table
                        v-model:selected="selectedMissions"
                    />
                </Suspense>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import type { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import { ProjectArchiveState } from '@kleinkram/shared';
import { useQueryClient } from '@tanstack/vue-query';
import ActionConfiguration from 'components/actions/action-configuration.vue';
import DeleteProjectDialogOpener from 'components/button-wrapper/delete-project-dialog-opener.vue';
import ChangeProjectRightsDialogOpener from 'components/button-wrapper/dialog-opener-change-project-rights.vue';
import ConfigureMetadataTypesDialogOpener from 'components/button-wrapper/dialog-opener-configure-metadata-types.vue';
import CreateMissionDialogOpener from 'components/button-wrapper/dialog-opener-create-mission.vue';
import EditProjectDialogOpener from 'components/button-wrapper/edit-project-dialog-opener.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import KleinDownloadMissions from 'components/cli-links/klein-download-missions.vue';
import AppCreateButton from 'components/common/app-create-button.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import ProjectStarButton from 'components/common/project-star-button.vue';
import PublicProjectChip from 'components/common/public-project-chip.vue';
import TableSelectionBar from 'components/common/table-selection-bar.vue';
import ExplorerPageMissionTable from 'components/explorer-page/explorer-page-mission-table.vue';
import ArchiveProjectDialogOpener from 'components/project-archive/archive-project-dialog-opener.vue';
import ArchivedProjectChip from 'components/project-archive/archived-project-chip.vue';
import ProjectArchiveBanner from 'components/project-archive/project-archive-banner.vue';
import RestoreProjectDialogOpener from 'components/project-archive/restore-project-dialog-opener.vue';
import TitleSection from 'components/title-section.vue';
import UploadMissionFolder from 'components/upload-mission-folder.vue';
import { copyToClipboard, useQuasar } from 'quasar';
import { useProjectArchived } from 'src/composables/use-project-archive';
import { usePublicReadOnlyView } from 'src/composables/use-public-read-only-view';
import DeleteMissionDialog from 'src/dialogs/delete-mission-dialog.vue';
import {
    canDeleteProject,
    registerNoPermissionErrorHandler,
    useHandler,
    usePermissionsQuery,
    useProjectQuery,
} from 'src/hooks/query-hooks';
import { useProjectUUID } from 'src/hooks/router-hooks';
import { computed, ref, Ref } from 'vue';

const queryClient = useQueryClient();
const handler = useHandler();
const $q = useQuasar();
const projectUuid = useProjectUUID();
const { data: project, isLoadingError, error } = useProjectQuery(projectUuid);
const createAction = ref(false);

registerNoPermissionErrorHandler(isLoadingError, projectUuid, 'project', error);

const { data: permissions } = usePermissionsQuery();
const isReadOnlyPublicView = usePublicReadOnlyView(projectUuid);
const isArchived = useProjectArchived(projectUuid);
/** Archived projects are read-only for everybody, like public ones. */
const isReadOnly = computed(
    () => isReadOnlyPublicView.value || isArchived.value,
);
const canManageArchive = computed(() =>
    canDeleteProject(projectUuid.value, permissions.value),
);

/** Tells the users who manage access that the project is public. */
const showPublicAccessHint = computed(
    () =>
        project.value?.isPublic === true &&
        canDeleteProject(projectUuid.value, permissions.value),
);

/**
 * Repeating a (potentially long) project name in the section heading wastes
 * the little horizontal space a phone has, the title section right above
 * already shows it.
 */
const missionsHeading = computed(() =>
    $q.screen.lt.md
        ? 'Missions'
        : `All Missions of ${project.value?.name ?? ''}`,
);

const onClose = (): void => {
    createAction.value = false;
};

const deleteMission = (): void => {
    const mission = selectedMissions.value[0];

    if (mission === undefined) {
        $q.notify({
            type: 'negative',
            message: 'Please select a mission to delete',
        });
        return;
    }

    $q.dialog({
        title: 'Delete Mission',
        component: DeleteMissionDialog,
        componentProps: {
            missionUuid: mission.uuid,
        },
    });

    deselect();
};

const selectedMissions: Ref<FlatMissionDto[]> = ref([]);

const search = computed({
    get: () => handler.value.searchParams.name,
    set: (value: string) => {
        handler.value.setSearch({ name: value });
    },
});

const selectedMissionUuids = computed(() => {
    return selectedMissions.value.map((mission) => mission.uuid);
});

async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({
        queryKey: ['missions'],
    });
}

function deselect(): void {
    selectedMissions.value = [];
}

function openMultiActions(): void {
    createAction.value = true;
}

const copyProjectUuidToClipboard = async (): Promise<void> => {
    await copyToClipboard(projectUuid.value ?? '');
};
</script>

<style scoped>
/*
 * Desktop keeps the original single row: heading on the left, search and the
 * action buttons on the right.
 */
.public-project-banner {
    background: #ffffff;
    border: 1px solid #cfe6d6;
    border-left: 4px solid #1b7a3a;
    border-radius: 3px;
}

.missions-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
}

.missions-toolbar__title {
    margin-right: auto;
    min-width: 0;
    overflow-wrap: anywhere;
}

.missions-toolbar__actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.missions-selection__cli {
    max-width: 400px;
}

/*
 * Below 1024px the heading, the search field and the buttons each get their
 * own row and the buttons keep comfortable touch targets.
 */
@media (max-width: 1023px) {
    .missions-toolbar {
        flex-wrap: wrap;
        gap: 8px;
    }

    .missions-toolbar__title {
        flex: 1 0 100%;
        margin-right: 0;

        /* `text-h4` is far too large on a phone; fall back to a h6 scale */
        font-size: 1.25rem;
        font-weight: 500;
        line-height: 1.75rem;
        letter-spacing: 0.0125em;
    }

    .missions-toolbar__search {
        flex: 1 0 100%;
        min-width: 0;
    }

    .missions-toolbar__actions {
        flex-wrap: wrap;
        gap: 8px;
    }

    .missions-toolbar__actions :deep(.q-btn) {
        min-height: 40px;
        min-width: 40px;
    }

    .missions-toolbar__search :deep(.q-field .q-field__control),
    .missions-toolbar__search :deep(.q-field .q-field__marginal) {
        height: 40px;
        min-height: 40px;
    }

    /*
     * The selection bar stacks: the counter above the wrapped actions. The
     * horizontal inset moves from margin/padding-left to symmetric padding so
     * a full-width row cannot push the page into horizontal scrolling.
     */
    .missions-selection__cli {
        flex: 1 0 100%;
        max-width: 100%;
    }
}
</style>
