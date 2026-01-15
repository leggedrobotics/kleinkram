<template>
    <q-drawer
        v-model="internalOpen"
        side="right"
        :width="600"
        bordered
        overlay
        behavior="desktop"
    >
        <div class="column full-height">
            <!-- Header -->
            <div class="row justify-between items-center q-pa-md border-bottom">
                <div class="text-h6">
                    {{ isEditing ? 'Edit Trigger' : 'Create Trigger' }}
                </div>
                <q-btn
                    flat
                    round
                    dense
                    icon="sym_o_close"
                    @click="closeDrawer"
                />
            </div>

            <!-- Content -->
            <q-scroll-area class="col">
                <q-form
                    ref="formReference"
                    class="q-gutter-y-md q-pa-md"
                    @submit="saveTrigger"
                >
                    <!-- General Info -->
                    <div>
                        <div class="text-weight-bold q-mb-xs">
                            Name <span class="text-negative">*</span>
                        </div>
                        <q-input
                            v-model="localTrigger.name"
                            outlined
                            dense
                            placeholder="e.g. Nightly Build"
                            :rules="[(val) => !!val || 'Name is required']"
                        />
                    </div>

                    <div>
                        <div class="text-weight-bold q-mb-xs">Description</div>
                        <q-input
                            v-model="localTrigger.description"
                            outlined
                            dense
                            type="textarea"
                            rows="2"
                            placeholder="Describe when this trigger runs..."
                        />
                    </div>

                    <div>
                        <div class="text-weight-bold q-mb-xs">
                            Action Scope <span class="text-negative">*</span>
                        </div>
                        <ScopeSelector
                            v-model:project-uuid="localProjectUuid"
                            v-model:mission-uuid="localTrigger.missionUuid"
                            layout="column"
                            required
                            :custom-mission-rules="[
                                (val: string) => !!val || 'Mission is required',
                            ]"
                        />
                    </div>

                    <div>
                        <div class="text-weight-bold q-mb-xs">
                            Action Template <span class="text-negative">*</span>
                        </div>
                        <q-select
                            v-model="localTrigger.templateUuid"
                            :options="templateOptions"
                            option-value="uuid"
                            option-label="name"
                            emit-value
                            map-options
                            outlined
                            dense
                            :placeholder="
                                localTrigger.templateUuid
                                    ? undefined
                                    : 'Select Action Template'
                            "
                            :rules="[
                                (val) => !!val || 'Action Template is required',
                            ]"
                            :loading="isLoadingTemplates"
                            use-input
                            @filter="filterTemplates"
                        >
                            <template #option="scope">
                                <q-item v-bind="scope.itemProps">
                                    <q-item-section>
                                        <q-item-label>{{
                                            scope.opt.name
                                        }}</q-item-label>
                                        <q-item-label caption
                                            >v{{
                                                scope.opt.version
                                            }}</q-item-label
                                        >
                                    </q-item-section>
                                </q-item>
                            </template>
                        </q-select>
                    </div>

                    <div>
                        <div class="text-weight-bold q-mb-xs">
                            Trigger Type <span class="text-negative">*</span>
                        </div>
                        <q-select
                            v-model="localTrigger.type"
                            :options="triggerTypeOptions"
                            outlined
                            dense
                            emit-value
                            map-options
                            :disable="isEditing"
                        />
                    </div>

                    <q-separator />

                    <!-- Dynamic Configuration -->
                    <div v-if="localTrigger.type">
                        <div class="text-h6 q-mb-md">Configuration</div>

                        <!-- Webhook Config -->
                        <div v-if="localTrigger.type === TriggerType.WEBHOOK">
                            <div
                                class="q-pa-sm bg-grey-2 rounded-borders q-mt-xs"
                            >
                                <div class="row items-center no-wrap">
                                    <div
                                        class="q-mr-sm"
                                        style="
                                            flex: 1 1 auto;
                                            word-break: break-all;
                                            font-family: monospace;
                                        "
                                    >
                                        {{ ENV.BACKEND_URL }}/hooks/actions/{{
                                            localTrigger.uuid ||
                                            'generated-uuid'
                                        }}
                                    </div>
                                    <q-btn
                                        icon="sym_o_content_copy"
                                        flat
                                        dense
                                        round
                                        color="primary"
                                        @click="copyWebhookUrl"
                                    >
                                        <q-tooltip>Copy URL</q-tooltip>
                                    </q-btn>
                                </div>
                            </div>
                            <div class="q-mt-sm text-caption text-grey-7">
                                Send a POST request to this URL to trigger the
                                action.
                            </div>
                        </div>

                        <!-- Time Config -->
                        <div v-else-if="localTrigger.type === TriggerType.TIME">
                            <div>
                                <div class="text-weight-bold q-mb-xs">
                                    Cron Schedule
                                    <span class="text-negative">*</span>
                                </div>
                                <q-input
                                    :model-value="
                                        (localTrigger.config as any)?.cron
                                    "
                                    outlined
                                    dense
                                    placeholder="* * * * *"
                                    :rules="[
                                        (val) =>
                                            !!val ||
                                            'Cron schedule is required',
                                        (val) =>
                                            isValidCron(val) ||
                                            'Invalid cron expression',
                                    ]"
                                    @update:model-value="onUpdateCron"
                                >
                                    <template #append>
                                        <q-icon name="sym_o_schedule" />
                                    </template>
                                </q-input>
                                <div
                                    v-if="(localTrigger.config as any)?.cron"
                                    class="q-mt-xs text-caption text-primary text-weight-medium bg-blue-1 q-pa-xs rounded-borders"
                                >
                                    <q-icon
                                        name="sym_o_info"
                                        size="xs"
                                        class="q-mr-xs"
                                    />
                                    {{
                                        cronToHuman(
                                            (localTrigger.config as any).cron,
                                        )
                                    }}
                                </div>
                                <div
                                    v-else
                                    class="text-caption text-grey-7 q-mt-xs"
                                >
                                    Min Hour Day Month DayOfWeek (e.g. 0 0 * *
                                    *)
                                </div>
                            </div>
                        </div>

                        <!-- File Config -->
                        <div v-else-if="localTrigger.type === TriggerType.FILE">
                            <div>
                                <div class="text-weight-bold q-mb-xs">
                                    File Patterns
                                    <span class="text-negative">*</span>
                                </div>
                                <q-select
                                    :model-value="
                                        (localTrigger.config as any)?.patterns
                                    "
                                    use-input
                                    use-chips
                                    multiple
                                    hide-dropdown-icon
                                    input-debounce="0"
                                    outlined
                                    dense
                                    placeholder="Type pattern and press Enter (e.g. *.bag)"
                                    :rules="[
                                        (val) =>
                                            (val && val.length > 0) ||
                                            'At least one pattern is required',
                                    ]"
                                    @update:model-value="onUpdatePatterns"
                                    @new-value="createValue"
                                />
                                <div class="text-caption text-grey-7 q-mt-xs">
                                    Supports * wildcard. Press Enter to add
                                    pattern.
                                </div>
                            </div>
                        </div>
                    </div>
                </q-form>
            </q-scroll-area>

            <!-- Footer -->
            <div class="row justify-end q-pa-md q-gutter-x-sm border-top">
                <q-btn
                    flat
                    label="Cancel"
                    color="grey-7"
                    @click="closeDrawer"
                />
                <q-btn
                    unelevated
                    color="primary"
                    :label="isEditing ? 'Save Changes' : 'Create Trigger'"
                    :loading="isSaving"
                    @click="saveTrigger"
                />
            </div>
        </div>
    </q-drawer>
</template>

<script setup lang="ts">
import type { ActionTemplateDto } from '@kleinkram/api-dto/types/actions/action-template.dto';
import type { ActionTriggerDto } from '@kleinkram/api-dto/types/actions/action-trigger.dto';
import type { CreateActionTriggerDto } from '@kleinkram/api-dto/types/actions/create-action-trigger.dto';
import type { UpdateActionTriggerDto } from '@kleinkram/api-dto/types/actions/update-action-trigger.dto';
import { cronToHuman, isValidCron, TriggerType } from '@kleinkram/shared';
import ScopeSelector from 'components/common/scope-selector.vue';
import { QForm, uid, useQuasar } from 'quasar';
import { ActionService } from 'src/api/services/action.service';
import ENV from 'src/environment';
import { useHandler } from 'src/hooks/query-hooks';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    open: boolean;
    triggerToEdit?: ActionTriggerDto | undefined;
}>();

const emit = defineEmits(['close', 'saved']);
const $q = useQuasar();
const handler = useHandler();

// State
const formReference = ref<QForm | null>(null);
const isSaving = ref(false);
const isLoadingTemplates = ref(false);
const templateOptions = ref<ActionTemplateDto[]>([]);
const allTemplates = ref<ActionTemplateDto[]>([]);

// Default State
const defaultState: Partial<CreateActionTriggerDto> = {
    name: '',
    description: '',
    templateUuid: '',
    missionUuid: '',
    type: TriggerType.WEBHOOK,
    config: {},
};

const localTrigger = ref<Partial<CreateActionTriggerDto>>({ ...defaultState });
const localProjectUuid = ref<string | undefined>(undefined);

const triggerTypeOptions = [
    { label: 'Webhook', value: TriggerType.WEBHOOK },
    { label: 'Time Schedule (Cron)', value: TriggerType.TIME },
    { label: 'File Watcher', value: TriggerType.FILE },
];

// Computed
const internalOpen = computed({
    get: () => props.open,
    set: (value) => {
        if (!value) closeDrawer();
    },
});

const isEditing = computed(() => !!props.triggerToEdit);

// Watchers
watch(
    () => props.open,
    async (isOpen) => {
        if (isOpen) {
            await loadTemplates();
            if (props.triggerToEdit) {
                localTrigger.value = structuredClone(
                    props.triggerToEdit,
                ) as Partial<CreateActionTriggerDto>;
            } else {
                localTrigger.value = {
                    ...structuredClone(defaultState),
                    uuid: uid(), // Optimistic UUID
                    missionUuid: handler.value.missionUuid ?? '',
                };
                localProjectUuid.value = handler.value.projectUuid;
            }
        }
    },
);

watch(
    () => localTrigger.value.type,
    (newType, oldType) => {
        if (newType === oldType) return;
        // Reset config when type changes
        switch (newType) {
            case TriggerType.WEBHOOK: {
                localTrigger.value.config = {};

                break;
            }
            case TriggerType.TIME: {
                localTrigger.value.config = { cron: '' };

                break;
            }
            case TriggerType.FILE: {
                localTrigger.value.config = { patterns: [] };

                break;
            }
            // No default
        }
    },
);

// Methods
const loadTemplates = async () => {
    isLoadingTemplates.value = true;
    try {
        const result = await ActionService.listTemplates('', false, 0, 100);
        allTemplates.value = result.data;
        templateOptions.value = result.data;
    } catch (error) {
        console.error('Failed to load templates', error);
    } finally {
        isLoadingTemplates.value = false;
    }
};

const filterTemplates = (
    value: string,
    update: (callback: () => void) => void,
) => {
    if (value === '') {
        update(() => {
            templateOptions.value = allTemplates.value;
        });
        return;
    }

    update(() => {
        const needle = value.toLowerCase();
        templateOptions.value = allTemplates.value.filter(
            (v: ActionTemplateDto) => v.name.toLowerCase().includes(needle),
        );
    });
};

const setConfigField = (field: string, value: unknown) => {
    localTrigger.value.config ??= {} as Record<string, unknown>;
    const config = localTrigger.value.config as Record<string, unknown>;
    config[field] = value;
};

const onUpdateCron = (value: string | number | null) => {
    setConfigField('cron', value?.toString() ?? '');
};

const onUpdatePatterns = (value: string[] | null) => {
    setConfigField('patterns', value ?? []);
};

const createValue = (
    value: string,
    done: (item: string, mode: 'add' | 'add-unique' | 'toggle') => void,
) => {
    if (value.length > 0) {
        done(value, 'add-unique');
    }
};

const closeDrawer = () => {
    emit('close');
};

const saveTrigger = async () => {
    const valid = await formReference.value?.validate();
    if (!valid) return;

    isSaving.value = true;
    try {
        if (isEditing.value && props.triggerToEdit) {
            await ActionService.updateTrigger(
                props.triggerToEdit.uuid,
                localTrigger.value as UpdateActionTriggerDto,
            );
            $q.notify({ type: 'positive', message: 'Trigger updated' });
        } else {
            await ActionService.createTrigger(
                localTrigger.value as CreateActionTriggerDto,
            );
            $q.notify({ type: 'positive', message: 'Trigger created' });
        }
        emit('saved');
        closeDrawer();
    } catch {
        $q.notify({ type: 'negative', message: 'Failed to save trigger' });
    } finally {
        isSaving.value = false;
    }
};

const copyWebhookUrl = async () => {
    const url = `${ENV.BACKEND_URL}/hooks/actions/${localTrigger.value.uuid ?? 'generated-uuid'}`;
    await navigator.clipboard.writeText(url);
    $q.notify({ type: 'positive', message: 'Webhook URL copied to clipboard' });
};
</script>

<style scoped>
.border-bottom {
    border-bottom: 1px solid #e0e0e0;
}
.border-top {
    border-top: 1px solid #e0e0e0;
}
</style>
