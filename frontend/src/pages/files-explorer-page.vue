<template>
    <div>
        <title-section :title="mission?.name">
            <!--
                On phones the chip does not fit next to the (already
                ellipsized) mission name, so it is rendered underneath the
                title instead of beside it.
            -->
            <template v-if="mission?.metadata" #[metadataChipSlot]>
                <div class="q-shrink">
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
                                >{{ mission.metadata.length }} metadata
                                attributes</span
                            >
                        </span>
                    </q-btn>
                </div>
            </template>

            <template #buttons>
                <button-group>
                    <q-btn
                        v-if="mission"
                        class="button-border"
                        flat
                        style="height: 100%"
                        color="primary"
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
                        color="primary"
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
                </button-group>
            </template>

            <template #tabs>
                <q-tabs
                    v-model="activeTab"
                    align="left"
                    active-color="primary"
                    dense
                    class="text-grey"
                >
                    <q-tab
                        name="info"
                        label="Mission Info"
                        :disable="!readme"
                        :style="readme ? 'color: #222' : undefined"
                    >
                        <q-tooltip v-if="!readme && !isReadmeLookupPending">
                            Add a README.md to this mission to describe it here
                        </q-tooltip>
                    </q-tab>
                    <q-tab name="files" label="Files" style="color: #222" />
                    <q-tab
                        name="actions"
                        label="Action Executions"
                        style="color: #222"
                    />
                </q-tabs>
            </template>
        </title-section>

        <div v-if="!activeTab" class="row justify-center q-mt-xl text-grey-7">
            <q-spinner-dots size="2em" />
        </div>

        <q-tab-panels
            v-else
            v-model="activeTab"
            class="q-mt-lg"
            style="background: transparent"
        >
            <q-tab-panel name="info" class="q-pa-none">
                <MissionInfo
                    :readme="readme"
                    :content="readmeContent"
                    :is-content-loading="isReadmeContentLoading"
                    :content-error="readmeContentError"
                />
            </q-tab-panel>

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
import ButtonGroup from 'components/buttons/button-group.vue';
import KleinDownloadMission from 'components/cli-links/klein-download-mission.vue';
import MissionActions from 'components/explorer-page/mission-actions.vue';
import MissionFiles from 'components/explorer-page/mission-files.vue';
import MissionInfo from 'components/explorer-page/mission-info.vue';
import MissionMetadataDrawer from 'components/explorer-page/mission-metadata-drawer.vue';
import TitleSection from 'components/title-section.vue';
import { copyToClipboard, Notify, useQuasar } from 'quasar';
import { useMissionReadme } from 'src/composables/use-mission-readme';
import {
    registerNoPermissionErrorHandler,
    useMission,
} from 'src/hooks/query-hooks';
import { useMissionUUID } from 'src/hooks/router-hooks';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const $router = useRouter();
const $route = useRoute();
const $q = useQuasar();

const missionUuid = useMissionUUID();
const isMetadataDrawerOpen = ref(false);

/**
 * The metadata chip sits next to the title on wider screens and moves below
 * it on phones, where the title row has no room left.
 */
const metadataChipSlot = computed<'subtitle' | 'titleAppend'>(() =>
    $q.screen.xs ? 'subtitle' : 'titleAppend',
);

const openMetadataDrawer = () => {
    isMetadataDrawerOpen.value = true;
};

const {
    readme,
    isLookupPending: isReadmeLookupPending,
    content: readmeContent,
    isContentLoading: isReadmeContentLoading,
    contentError: readmeContentError,
} = useMissionReadme(missionUuid);

/**
 * Without a tab in the URL the mission opens on its README, or on the file
 * list when it has none. Until the lookup answers there is no tab to show,
 * which renders a spinner instead of flashing the files first.
 */
const activeTab = computed({
    get: (): string => {
        const requested = $route.params.tab as string | undefined;
        if (requested && requested !== 'info') return requested;
        // Query parameters only come from the file list (filters, paging,
        // sorting). A link carrying them is a saved file view, so it opens
        // on Files; showing Mission Info first would drop them on the way.
        if (!requested && Object.keys($route.query).length > 0) return 'files';
        if (isReadmeLookupPending.value) return '';
        if (readme.value) return 'info';
        return 'files';
    },
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
