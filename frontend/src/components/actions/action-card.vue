<template>
    <q-card
        class="action-card cursor-pointer q-hoverable relative-position overflow-hidden column"
        :class="{ 'shadow-4': hover, 'bg-grey-2': template.archived }"
        @mouseover="onMouseOver"
        @mouseleave="onMouseLeave"
        @click="onRun"
    >
        <div
            class="absolute-left full-height"
            :class="template.archived ? 'bg-grey-5' : `bg-${color}-6`"
            style="width: 5px"
        />

        <q-card-section class="col q-pb-none q-pl-md flex column no-wrap">
            <div class="row no-wrap items-center q-mb-sm">
                <q-avatar
                    rounded
                    size="42px"
                    font-size="18px"
                    :color="template.archived ? 'grey-4' : `${color}-1`"
                    :text-color="template.archived ? 'grey-7' : `${color}-9`"
                    class="q-mr-md"
                >
                    <span class="text-weight-bold">{{ initials }}</span>
                </q-avatar>

                <div class="overflow-hidden col">
                    <div class="row items-center justify-between">
                        <div
                            class="text-subtitle1 text-weight-bold ellipsis text-grey-9"
                        >
                            {{ template.name }}
                        </div>
                        <q-badge
                            v-if="template.archived"
                            color="grey"
                            label="Archived"
                        />
                    </div>

                    <div class="row q-gutter-x-sm q-mt-xs">
                        <q-badge
                            outline
                            color="grey-7"
                            :label="`v${template.version}`"
                        />
                        <q-badge
                            color="grey-3"
                            text-color="grey-9"
                            :label="template.creator?.name ?? 'System'"
                        />
                    </div>
                </div>
            </div>

            <div
                class="text-caption text-grey-8 ellipsis-3-lines col-grow relative-position"
            >
                {{ template.description || 'No description provided.' }}
                <q-tooltip
                    v-if="
                        template.description &&
                        template.description.length > 100
                    "
                >
                    {{ template.description }}
                </q-tooltip>
            </div>

            <div
                class="row q-py-sm q-gutter-x-md text-caption text-grey-7 items-center"
            >
                <div class="flex items-center" title="CPU Cores">
                    <q-icon name="sym_o_memory" class="q-mr-xs" />
                    <span>{{ template.cpuCores }} Core</span>
                </div>

                <div
                    v-if="template.gpuMemory > -1"
                    class="flex items-center text-deep-purple"
                    title="GPU Enabled"
                >
                    <q-icon name="sym_o_grid_view" class="q-mr-xs" />
                    <span>GPU</span>
                </div>

                <div class="flex items-center" title="Total Executions">
                    <q-icon name="sym_o_play_circle" class="q-mr-xs" />
                    <span>{{ template.executionCount }} Runs</span>
                </div>

                <div class="flex items-center" title="Max Runtime">
                    <q-icon name="sym_o_schedule" class="q-mr-xs" />
                    <span>{{ template.maxRuntime }}h</span>
                </div>
            </div>
        </q-card-section>

        <q-separator inset />

        <q-card-actions
            class="row items-center justify-between q-px-sm bg-grey-1"
            style="height: 50px"
        >
            <div class="row q-gutter-x-xs">
                <q-btn
                    flat
                    round
                    dense
                    color="grey-7"
                    icon="sym_o_history"
                    @click.stop="onRevisions"
                >
                    <q-tooltip>Revisions</q-tooltip>
                </q-btn>
                <q-btn
                    flat
                    round
                    dense
                    color="grey-7"
                    icon="sym_o_edit"
                    :disable="template.archived"
                    @click.stop="onEdit"
                >
                    <q-tooltip>Edit / New Revision</q-tooltip>
                </q-btn>
                <q-btn
                    flat
                    round
                    dense
                    color="negative"
                    icon="sym_o_delete"
                    @click.stop="onDelete"
                >
                    <q-tooltip>Delete or Archive</q-tooltip>
                </q-btn>
            </div>

            <q-btn
                unelevated
                color="primary"
                icon="sym_o_play_arrow"
                label="Run"
                class="q-px-md"
                :disable="template.archived"
                @click.stop="onRun"
            />
        </q-card-actions>
    </q-card>
</template>

<script setup lang="ts">
import { ActionTemplateDto } from '@api/types/actions/action-template.dto';
import { computed, ref } from 'vue';

const props = defineProps<{
    template: ActionTemplateDto;
}>();

const emit =
    defineEmits<(event: 'run' | 'edit' | 'revisions' | 'delete') => void>();

const hover = ref(false);

// --- Event Handlers ---
const onMouseOver = (): void => {
    hover.value = true;
};

const onMouseLeave = (): void => {
    hover.value = false;
};

const onRun = (): void => {
    emit('run');
};

const onEdit = (): void => {
    emit('edit');
};

const onRevisions = (): void => {
    emit('revisions');
};

const onDelete = (): void => {
    emit('delete');
};

// --- Computed Props ---
const initials = computed(() => {
    const parts = props.template.name.split(/[\s_-]+/);
    if (parts.length >= 2) {
        const first = parts[0]?.[0] ?? '';
        const second = parts[1]?.[0] ?? '';
        return `${first}${second}`.toUpperCase();
    }
    return props.template.name.slice(0, 2).toUpperCase();
});

const color = computed(() => {
    const colors = [
        'blue',
        'teal',
        'purple',
        'indigo',
        'cyan',
        'orange',
        'deep-orange',
    ];
    let hash = 0;
    for (let index = 0; index < props.template.name.length; index++) {
        const code = props.template.name.codePointAt(index) ?? 0;
        hash = code + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
});
</script>

<style scoped>
.action-card {
    transition: all 0.2s ease;
    border: 1px solid #e0e0e0;
    height: 260px;
}
</style>
