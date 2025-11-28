<template>
    <title-section title="Kleinkram Actions">
        <template #tabs>
            <q-tabs
                v-model="activeTab"
                align="left"
                active-color="primary"
                dense
                class="text-grey"
            >
                <q-tab name="store" label="Action Templates" style="color: #222" />
                <q-tab
                    name="executions"
                    label="Executions"
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
        <q-tab-panel name="store" class="q-pa-none">
            <ActionStore
                @select="openLaunchConfiguration"
                @create="openCreateConfiguration"
                @edit="openEditConfiguration"
                @revisions="openHistoryDrawer"
            />
        </q-tab-panel>

        <q-tab-panel name="executions" class="q-pa-none">
            <ActionExecutions />
        </q-tab-panel>
    </q-tab-panels>

    <ActionLaunchDrawer
        :open="isLaunchOpen"
        :template="selectedTemplate"
        @create-action="openCreateConfiguration"
        @close="closeDrawers"
    />

    <ActionDefinitionDrawer
        :open="isCreateOpen"
        :initial-template="selectedTemplate"
        @saved="onTemplateSaved"
        @close="closeDrawers"
    />

    <ActionRevisionsDrawer
        :open="isHistoryOpen"
        :versions="selectedHistoryVersions"
        @restore="onRestoreVersion"
        @close="closeHistoryDrawer"
    />

    <BullQueue v-if="showBullQueue" />
</template>

<script setup lang="ts">
import { ActionTemplateDto } from '@api/types/actions/action-template.dto';
import { ActionTemplatesDto } from '@api/types/actions/action-templates.dto';
import { UserRole } from '@common/enum';
import { usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed, ref } from 'vue';

// Components
import { useQueryClient } from '@tanstack/vue-query';
import ActionDefinitionDrawer from 'components/actions/action-definition-drawer.vue';
import ActionExecutions from 'components/actions/action-executions.vue';
import ActionLaunchDrawer from 'components/actions/action-launch-drawer.vue';
import ActionRevisionsDrawer from 'components/actions/action-revisions-drawer.vue';
import ActionStore from 'components/actions/action-store.vue';
import BullQueue from 'components/bull-queue.vue';
import TitleSection from 'components/title-section.vue';
import { Notify } from 'quasar';
import { actionKeys } from 'src/api/keys/action-keys';
import { ActionService } from 'src/api/services/action.service';

import { useRoute, useRouter } from 'vue-router';

// State
const route = useRoute();
const router = useRouter();

const TAB_MAPPING = {
    store: 'templates',
    executions: 'runs',
} as const;

const REVERSE_TAB_MAPPING = {
    templates: 'store',
    runs: 'executions',
} as const;

const activeTab = computed({
    get: () => {
        const tabParam = route.params.tab as string | undefined;
        if (tabParam && tabParam in REVERSE_TAB_MAPPING) {
            return REVERSE_TAB_MAPPING[tabParam as keyof typeof REVERSE_TAB_MAPPING];
        }
        return 'store';
    },
    set: (value: string) => {
        const tabSlug = TAB_MAPPING[value as keyof typeof TAB_MAPPING] || 'templates';
        router.replace({ params: { ...route.params, tab: tabSlug }, query: route.query });
    },
});
const isLaunchOpen = ref(false);
const isCreateOpen = ref(false);
const selectedTemplate = ref<ActionTemplateDto | undefined>(undefined);

const isHistoryOpen = ref(false);
const selectedHistoryVersions = ref<ActionTemplatesDto>({
    data: [],
    count: 0,
    skip: 0,
    take: 0,
} as ActionTemplatesDto);

const queryClient = useQueryClient();

const { data: permissions } = usePermissionsQuery();
const showBullQueue = computed(
    () => permissions.value?.role === UserRole.ADMIN,
);

// --- Handlers ---
const openHistoryDrawer = async (
    template: ActionTemplateDto,
): Promise<void> => {
    try {
        selectedHistoryVersions.value = await queryClient.fetchQuery({
            queryKey: actionKeys.templates.revisions(template.uuid),
            queryFn: () => ActionService.getTemplateRevisions(template.uuid),
        });

        isHistoryOpen.value = true;
    } catch {
        Notify.create({
            message: 'Failed to load version history',
            color: 'negative',
        });
    }
};

const onRestoreVersion = (oldVersion: ActionTemplateDto): void => {
    selectedTemplate.value = oldVersion;
    isHistoryOpen.value = false;
    isCreateOpen.value = true;
};

const openEditConfiguration = (template: ActionTemplateDto): void => {
    selectedTemplate.value = template;
    isCreateOpen.value = true;
};

const openLaunchConfiguration = (template: ActionTemplateDto): void => {
    selectedTemplate.value = template;
    isLaunchOpen.value = true;
    isCreateOpen.value = false;
};

const openCreateConfiguration = (): void => {
    selectedTemplate.value = undefined;
    isCreateOpen.value = true;
    isLaunchOpen.value = false;
};

const closeDrawers = (): void => {
    isLaunchOpen.value = false;
    isCreateOpen.value = false;
    selectedTemplate.value = undefined;
};

const onTemplateSaved = (): void => {
    activeTab.value = 'store';
};

const closeHistoryDrawer = (): void => {
    isHistoryOpen.value = false;
};
</script>

<style scoped></style>
