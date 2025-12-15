<template>
    <div>
        <title-section :title="mission?.name">
            <template #subtitle>
                <div>
                    <div class="flex justify-between items-center">
                        <div>
                            <div class="flex">
                                <span
                                    v-for="tag in mission?.tags ??
                                    ([] as TagDto[])"
                                    :key="tag.uuid"
                                    class="q-mr-xs"
                                >
                                    <q-chip
                                        square
                                        :style="[
                                            tag.type.datatype == 'LINK'
                                                ? { cursor: 'pointer' }
                                                : {},
                                        ]"
                                        color="gray"
                                        @mouseup="() => openLink(tag)"
                                    >
                                        {{ tag.type.name }}:
                                        {{ tag.value }}
                                    </q-chip>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <template #buttons>
                <div class="row q-gutter-x-sm" style="height: 100%">
                    <MissionMetadataOpener v-if="mission" :mission="mission">
                        <q-btn
                            class="button-border"
                            flat
                            style="height: 100%"
                            color="primary"
                            icon="sym_o_sell"
                            label="Edit Metadata"
                        >
                            <q-tooltip> Manage Metadata</q-tooltip>
                        </q-btn>
                    </MissionMetadataOpener>

                    <q-btn
                        icon="sym_o_more_vert"
                        class="button-border"
                        flat
                        style="height: 100%"
                    >
                        <q-tooltip> More Actions</q-tooltip>

                        <q-menu v-if="mission" auto-close style="width: 320px">
                            <q-list>
                                <klein-download-mission
                                    v-if="mission"
                                    :mission="mission"
                                />
                                <q-separator class="q-ma-sm" />
                                <MoveMissionDialogOpener
                                    v-if="mission"
                                    :mission="mission"
                                >
                                    <q-item v-close-popup clickable>
                                        <q-item-section avatar>
                                            <q-icon name="sym_o_move_down" />
                                        </q-item-section>
                                        <q-item-section>
                                            Move Mission
                                        </q-item-section>
                                    </q-item>
                                </MoveMissionDialogOpener>

                                <q-item v-close-popup clickable disable>
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_lock" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-section>
                                            Manage Access
                                        </q-item-section>
                                    </q-item-section>
                                    <q-tooltip>
                                        Manage Access on Mission Level is not
                                        supported yet
                                    </q-tooltip>
                                </q-item>

                                <EditMissionDialogOpener
                                    v-if="mission"
                                    :mission="mission"
                                >
                                    <q-item v-close-popup clickable>
                                        <q-item-section avatar>
                                            <q-icon name="sym_o_edit" />
                                        </q-item-section>
                                        <q-item-section>
                                            <q-item-section>
                                                Edit Mission
                                            </q-item-section>
                                        </q-item-section>
                                    </q-item>
                                </EditMissionDialogOpener>

                                <q-item
                                    v-ripple
                                    clickable
                                    @click="copyMissionUuidToClipboard"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_fingerprint" />
                                    </q-item-section>
                                    <q-item-section> Copy UUID</q-item-section>
                                </q-item>

                                <delete-mission-dialog-opener
                                    v-if="mission"
                                    :mission="mission"
                                >
                                    <q-item
                                        v-close-popup
                                        clickable
                                        style="color: red"
                                    >
                                        <q-item-section avatar>
                                            <q-icon name="sym_o_delete" />
                                        </q-item-section>
                                        <q-item-section>
                                            <q-item-section>
                                                Delete Mission
                                            </q-item-section>
                                        </q-item-section>
                                    </q-item>
                                </delete-mission-dialog-opener>
                            </q-list>
                        </q-menu>
                    </q-btn>
                </div>
            </template>

            <template #tabs>
                <q-tabs
                    v-model="activeTab"
                    align="left"
                    active-color="primary"
                    dense
                    class="text-grey"
                >
                    <q-tab name="files" label="Files" style="color: #222" />
                    <q-tab
                        name="actions"
                        label="Action Executions"
                        style="color: #222"
                    />
                </q-tabs>
            </template>
        </title-section>

        <q-tab-panels
            v-model="activeTab"
            class="q-mt-lg"
            style="background: transparent"
        >
            <q-tab-panel name="files" class="q-pa-none">
                <MissionFiles />
            </q-tab-panel>

            <q-tab-panel name="actions" class="q-pa-none">
                <MissionActions />
            </q-tab-panel>
        </q-tab-panels>
    </div>
</template>

<script setup lang="ts">
import type { TagDto } from '@kleinkram/api-dto/types/tags/tags.dto';
import { DataType } from '@kleinkram/shared';
import DeleteMissionDialogOpener from 'components/button-wrapper/delete-mission-dialog-opener.vue';
import EditMissionDialogOpener from 'components/button-wrapper/edit-mission-dialog-opener.vue';
import MissionMetadataOpener from 'components/button-wrapper/mission-metadata-opener.vue';
import MoveMissionDialogOpener from 'components/button-wrapper/move-mission-dialog-pener.vue';
import KleinDownloadMission from 'components/cli-links/klein-download-mission.vue';
import MissionActions from 'components/explorer-page/mission-actions.vue';
import MissionFiles from 'components/explorer-page/mission-files.vue';
import TitleSection from 'components/title-section.vue';
import { copyToClipboard, Notify } from 'quasar';
import {
    registerNoPermissionErrorHandler,
    useMission,
} from 'src/hooks/query-hooks';
import { useMissionUUID } from 'src/hooks/router-hooks';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const $router = useRouter();
const $route = useRoute();

const missionUuid = useMissionUUID();
// We still need a handler in this scope?
// files-explorer-page previously had a handler.
// But now the children manage handlers.
// However, useMission error handler used handler to setMissionUUID to undefined?
// Let's see if we need that side effect.
// "handler.value.setMissionUUID(undefined)" likely cleared the UI state on error.
// We can skip that or instantiate a local handler if needed, but it's probably fine to just notify.
// Actually, relying on children is better.

const activeTab = computed({
    get: () => ($route.params.tab as string) || 'files',
    set: (value: string) => {
        void $router.replace({
            params: { ...$route.params, tab: value },
            query: {}, // Clear query on tab switch to avoid pollution
        });
    },
});

const {
    data: mission,
    isLoadingError,
    error: missionError,
} = useMission(
    missionUuid,
    (error: unknown) => {
        const errorMessage =
            (error as { response?: { data?: { message?: string } } }).response
                ?.data?.message ?? 'Unknown error';

        Notify.create({
            message: `Error fetching Mission: ${errorMessage}`,
            color: 'negative',
            timeout: 2000,
            position: 'bottom',
        });
        return false;
    },
    200,
);
registerNoPermissionErrorHandler(
    isLoadingError,
    missionUuid,
    'mission',
    missionError,
);

const openLink = (tag: TagDto): void => {
    if (tag.type.datatype !== DataType.LINK) return;
    window.open(tag.valueAsString, '_blank');
};

const copyMissionUuidToClipboard = async (): Promise<void> => {
    await copyToClipboard(missionUuid.value ?? '');
};
</script>

<style scoped>
.button-border:hover {
    border-color: #8d8d8d;
}
</style>
