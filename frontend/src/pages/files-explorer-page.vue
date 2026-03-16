<template>
    <div>
        <title-section :title="mission?.name">
            <template #title>
                <div class="row no-wrap items-center q-gutter-x-md">
                    <h1
                        class="text-h5 text-md-h3 q-ma-none ellipsis"
                        style="line-height: 1.2"
                    >
                        {{ mission?.name ?? '' }}
                        <q-tooltip v-if="mission?.name">
                            {{ mission?.name }}
                        </q-tooltip>
                    </h1>
                    <div v-if="mission?.tags" class="q-shrink">
                        <q-btn
                            unelevated
                            no-caps
                            dense
                            class="bg-grey-2 text-grey-9 q-px-sm"
                            style="
                                font-size: 12px;
                                font-weight: 500;
                                border-radius: 4px;
                                min-height: 24px;
                                padding-top: 2px;
                                padding-bottom: 2px;
                            "
                            @click="openMetadataDrawer"
                        >
                            <span
                                class="text-center col items-center justify-center row"
                            >
                                <q-icon
                                    name="sym_o_sell"
                                    size="14px"
                                    class="q-mr-xs"
                                />
                                <span
                                    >{{ mission.tags.length }} metadata
                                    attributes</span
                                >
                            </span>
                        </q-btn>
                    </div>
                </div>
            </template>

            <template #buttons>
                <div class="row q-gutter-x-sm" style="height: 100%">
                    <q-btn
                        v-if="mission"
                        class="button-border"
                        flat
                        style="height: 100%"
                        icon="sym_o_sell"
                        label="Metadata"
                        @click="openMetadataDrawer"
                    >
                    </q-btn>

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

        <MissionMetadataDrawer
            v-if="mission"
            v-model:open="isMetadataDrawerOpen"
            :mission="mission"
        />
    </div>
</template>

<script setup lang="ts">
import DeleteMissionDialogOpener from 'components/button-wrapper/delete-mission-dialog-opener.vue';
import EditMissionDialogOpener from 'components/button-wrapper/edit-mission-dialog-opener.vue';
import MoveMissionDialogOpener from 'components/button-wrapper/move-mission-dialog-pener.vue';
import KleinDownloadMission from 'components/cli-links/klein-download-mission.vue';
import MissionActions from 'components/explorer-page/mission-actions.vue';
import MissionFiles from 'components/explorer-page/mission-files.vue';
import MissionMetadataDrawer from 'components/explorer-page/mission-metadata-drawer.vue';
import TitleSection from 'components/title-section.vue';
import { copyToClipboard, Notify } from 'quasar';
import {
    registerNoPermissionErrorHandler,
    useMission,
} from 'src/hooks/query-hooks';
import { useMissionUUID } from 'src/hooks/router-hooks';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const $router = useRouter();
const $route = useRoute();

const missionUuid = useMissionUUID();
const isMetadataDrawerOpen = ref(false);

const openMetadataDrawer = () => {
    isMetadataDrawerOpen.value = true;
};

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

const copyMissionUuidToClipboard = async (): Promise<void> => {
    await copyToClipboard(missionUuid.value ?? '');
};
</script>

<style scoped>
.button-border:hover {
    border-color: #8d8d8d;
}
</style>
