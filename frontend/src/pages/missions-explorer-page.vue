<template>
    <div>
        <title-section :title="project?.name">
            <template v-if="project?.description.trim()" #subtitle>
                <p class="text-body2 text-grey-8 q-ma-none">
                    {{ project.description }}
                </p>
            </template>

            <template #buttons>
                <button-group>
                    <ConfigureTagsDialogOpener
                        v-if="projectUuid"
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
                    </ConfigureTagsDialogOpener>

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
                                <DeleteProjectDialogOpener
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
                    <UploadMissionFolder :project-uuid="projectUuid">
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
                    <create-mission-dialog-opener :project-uuid="projectUuid">
                        <app-create-button
                            :label="$q.screen.xs ? 'Create' : 'Create Mission'"
                            aria-label="Create Mission"
                        />
                    </create-mission-dialog-opener>
                </div>
            </div>
            <div
                v-else
                class="missions-selection"
                :class="$q.screen.xs ? 'q-py-md' : 'q-py-lg'"
                style="background: #0f62fe"
            >
                <ButtonGroupOverlay class="missions-selection__bar">
                    <template #start>
                        <div style="margin: 0; font-size: 14pt; color: white">
                            {{ selectedMissions.length }}
                            {{
                                selectedMissions.length === 1
                                    ? 'mission'
                                    : 'missions'
                            }}
                            selected
                        </div>
                    </template>
                    <template #end>
                        <KleinDownloadMissions
                            :missions="selectedMissions"
                            class="missions-selection__cli"
                        />
                        <q-btn
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
                        <q-btn
                            flat
                            dense
                            padding="6px"
                            icon="sym_o_close"
                            color="white"
                            aria-label="Clear selection"
                            @click="deselect"
                        />
                    </template>
                </ButtonGroupOverlay>
            </div>

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
import { useQueryClient } from '@tanstack/vue-query';
import ActionConfiguration from 'components/actions/action-configuration.vue';
import DeleteProjectDialogOpener from 'components/button-wrapper/delete-project-dialog-opener.vue';
import ChangeProjectRightsDialogOpener from 'components/button-wrapper/dialog-opener-change-project-rights.vue';
import ConfigureTagsDialogOpener from 'components/button-wrapper/dialog-opener-configure-tags.vue';
import CreateMissionDialogOpener from 'components/button-wrapper/dialog-opener-create-mission.vue';
import EditProjectDialogOpener from 'components/button-wrapper/edit-project-dialog-opener.vue';
import ButtonGroupOverlay from 'components/buttons/button-group-overlay.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import KleinDownloadMissions from 'components/cli-links/klein-download-missions.vue';
import AppCreateButton from 'components/common/app-create-button.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import ExplorerPageMissionTable from 'components/explorer-page/explorer-page-mission-table.vue';
import TitleSection from 'components/title-section.vue';
import UploadMissionFolder from 'components/upload-mission-folder.vue';
import { copyToClipboard, useQuasar } from 'quasar';
import DeleteMissionDialog from 'src/dialogs/delete-mission-dialog.vue';
import {
    registerNoPermissionErrorHandler,
    useHandler,
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
    .missions-selection__bar :deep(.q-ml-lg),
    .missions-selection__bar :deep(.q-pr-lg) {
        flex: 1 0 100%;
        margin-left: 0;
        padding-left: 16px;
        padding-right: 16px;
    }

    .missions-selection__cli {
        flex: 1 0 100%;
        max-width: 100%;
    }
}
</style>
