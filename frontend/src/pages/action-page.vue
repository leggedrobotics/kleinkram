<template>
    <title-section title="Kleinkram Actions">
        <template #tabs>
            <q-tabs
                :model-value="selectedTab"
                align="left"
                active-color="primary"
                dense
                class="text-grey"
                @update:model-value="onTabChange"
            >
                <q-tab name="store" label="Templates" style="color: #222" />
                <q-tab
                    name="executions"
                    label="Executions"
                    style="color: #222"
                />
                <q-tab name="triggers" style="color: #222">
                    <div class="row items-center no-wrap">
                        <span>Triggers</span>
                        <q-badge
                            color="orange-7"
                            text-color="white"
                            label="BETA"
                            class="text-weight-bold cursor-help q-ml-xs"
                            style="
                                font-size: 9px;
                                padding: 2px 4px;
                                vertical-align: middle;
                            "
                        >
                            <q-tooltip>
                                Trigger system is currently in beta.
                            </q-tooltip>
                        </q-badge>
                    </div>
                </q-tab>
            </q-tabs>
        </template>
    </title-section>

    <q-tab-panels
        :model-value="selectedTab"
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

        <q-tab-panel name="triggers" class="q-pa-none">
            <ActionTriggers />
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
        :mode="drawerMode"
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
</template>

<script setup lang="ts">
import type { ActionTemplateDto } from '@kleinkram/api-dto/types/actions/action-template.dto';
import type { ActionTemplatesDto } from '@kleinkram/api-dto/types/actions/action-templates.dto';

import { computed, ref, watch } from 'vue';

// Components
import { useQueryClient } from '@tanstack/vue-query';
import ActionDefinitionDrawer from 'components/actions/action-definition-drawer.vue';
import ActionExecutions from 'components/actions/action-executions.vue';
import ActionLaunchDrawer from 'components/actions/action-launch-drawer.vue';
import ActionRevisionsDrawer from 'components/actions/action-revisions-drawer.vue';
import ActionStore from 'components/actions/action-store.vue';
import ActionTriggers from 'components/actions/action-triggers.vue';

import TitleSection from 'components/title-section.vue';
import { Notify } from 'quasar';
import { actionKeys } from 'src/api/keys/action-keys';
import { ActionService } from 'src/api/services/action.service';
import { ActionDrawerMode } from 'src/router/enums';
import ROUTES from 'src/router/routes';

import { useRoute, useRouter } from 'vue-router';

// State
const route = useRoute();
const router = useRouter();

const TAB_MAPPING = {
    store: 'templates',
    executions: 'runs',
    triggers: 'triggers',
} as const;

const REVERSE_TAB_MAPPING = {
    templates: 'store',
    runs: 'executions',
    triggers: 'triggers',
} as const;

const selectedTab = computed(() => {
    const drawerAction = route.meta.drawerAction as string | undefined;

    if (drawerAction) {
        return 'store';
    }

    // Check for tab parameter
    const tabParameter = route.params.tab as string | undefined;
    if (tabParameter && tabParameter in REVERSE_TAB_MAPPING) {
        return REVERSE_TAB_MAPPING[
            tabParameter as keyof typeof REVERSE_TAB_MAPPING
        ];
    }

    // Fallback checks based on path
    if (route.path.includes('/actions/runs')) {
        return 'executions';
    }

    return 'store';
});

const onTabChange = (value: string | number | null) => {
    if (typeof value !== 'string') return;

    const tabSlug = TAB_MAPPING[value as keyof typeof TAB_MAPPING] as
        | string
        | undefined;

    if (
        route.name === ROUTES.ACTION.routeName &&
        route.meta.drawerAction === undefined
    ) {
        void router.replace({
            name: ROUTES.ACTION.routeName,
            params: { ...route.params, tab: tabSlug ?? 'templates' },
            query: route.query,
        });
    }
};

const isLaunchOpen = ref(false);
const isCreateOpen = ref(false);
const drawerMode = ref<ActionDrawerMode>(ActionDrawerMode.ACTION_CREATE);
const selectedTemplate = ref<ActionTemplateDto | undefined>(undefined);

const isHistoryOpen = ref(false);
const selectedHistoryVersions = ref<ActionTemplatesDto>({
    data: [],
    count: 0,
    skip: 0,
    take: 0,
} as ActionTemplatesDto);

const queryClient = useQueryClient();

// --- Handlers ---
const openHistoryDrawer = async (
    template: ActionTemplateDto,
): Promise<void> => {
    await router.push({
        name: ROUTES.ACTION_TEMPLATE_HISTORY.routeName,
        params: { templateId: template.uuid },
        query: route.query, // Preserve filters
    });
};

const onRestoreVersion = (oldVersion: ActionTemplateDto): void => {
    selectedTemplate.value = oldVersion;
    drawerMode.value = ActionDrawerMode.ACTION_RESTORE;
    isHistoryOpen.value = false;
    isCreateOpen.value = true;
};

const openLaunchConfiguration = async (template: ActionTemplateDto) => {
    await router.push({
        name: ROUTES.ACTION_TEMPLATE_LAUNCH.routeName,
        params: { templateId: template.uuid },
        query: route.query, // Preserve filters
    });
};

const closeDrawers = async () => {
    await router.push({
        name: ROUTES.ACTION.routeName,
        params: { tab: 'templates' },
        query: route.query, // Preserve filters
    });
};

const onTemplateSaved = (): void => {
    void closeDrawers();
};

const closeHistoryDrawer = (): void => {
    void closeDrawers();
};

const openCreateConfiguration = (): void => {
    selectedTemplate.value = undefined;
    drawerMode.value = ActionDrawerMode.ACTION_CREATE;
    isCreateOpen.value = true;
    // Optional: add a route for create if desired
};

const openEditConfiguration = async (template: ActionTemplateDto) => {
    await router.push({
        name: ROUTES.ACTION_TEMPLATE_EDIT.routeName,
        params: { templateId: template.uuid },
        query: route.query, // Preserve filters
    });
};

const handleRouteUpdate = async () => {
    const { templateId } = route.params;
    const drawerAction = route.meta.drawerAction as
        | ActionDrawerMode
        | undefined;

    isCreateOpen.value = false;
    isLaunchOpen.value = false;
    isHistoryOpen.value = false;

    if (!drawerAction || typeof templateId !== 'string') {
        return;
    }

    if (selectedTemplate.value?.uuid !== templateId) {
        try {
            selectedTemplate.value =
                await ActionService.getTemplate(templateId);
        } catch (error) {
            console.error('Failed to load template', error);
            Notify.create({
                message: 'Failed to load template',
                color: 'negative',
            });
            return;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!selectedTemplate.value) return;

    switch (drawerAction) {
        case ActionDrawerMode.ACTION_EDIT: {
            drawerMode.value = ActionDrawerMode.ACTION_EDIT;
            isCreateOpen.value = true;
            break;
        }
        case ActionDrawerMode.ACTION_HISTORY: {
            try {
                const uuid = selectedTemplate.value.uuid;
                selectedHistoryVersions.value = await queryClient.fetchQuery({
                    queryKey: actionKeys.templates.revisions(uuid),
                    queryFn: () => ActionService.getTemplateRevisions(uuid),
                });
                isHistoryOpen.value = true;
            } catch {
                Notify.create({
                    message: 'Failed to load version history',
                    color: 'negative',
                });
            }
            break;
        }
        case ActionDrawerMode.ACTION_LAUNCH: {
            isLaunchOpen.value = true;
            break;
        }
    }
};

watch(
    () => route.fullPath,
    () => {
        void handleRouteUpdate();
    },
    { immediate: true },
);
</script>

<style scoped></style>
