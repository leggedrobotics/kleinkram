<template>
    <q-drawer
        v-model="_open"
        side="right"
        :width="500"
        bordered
        behavior="desktop"
        overlay
    >
        <div class="q-pa-md row items-center justify-between bg-grey-1">
            <div class="text-h6">Version History</div>
            <q-btn flat round dense icon="sym_o_close" @click="closeDrawer" />
        </div>

        <div class="q-pa-md">
            <div class="text-subtitle2 q-mb-md">
                History for "{{ currentName }}"
            </div>

            <q-timeline color="primary">
                <q-timeline-entry
                    v-for="ver in sortedVersions"
                    :key="ver.uuid"
                    :title="`Version ${ver.version}`"
                    :subtitle="formatDate(ver.createdAt)"
                    :icon="
                        ver.version === currentVersion
                            ? 'sym_o_check_circle'
                            : 'sym_o_circle'
                    "
                    :color="
                        ver.version === currentVersion ? 'positive' : 'grey'
                    "
                >
                    <template #title>
                        <div class="row items-center q-gutter-x-sm">
                            <span>Version {{ ver.version }}</span>
                            <q-badge color="grey-3" text-color="grey-9">
                                <q-icon
                                    name="sym_o_play_circle"
                                    class="q-mr-xs"
                                />
                                {{ ver.executionCount }} Runs
                            </q-badge>
                        </div>
                    </template>

                    <div class="text-caption text-grey-8 q-mb-xs">
                        <div>
                            <strong>Author:</strong>
                            {{ ver.creator?.name ?? 'System' }}
                        </div>
                        <div class="q-mt-xs text-grey-6">
                            {{ ver.description }}
                        </div>
                        <q-separator class="q-my-xs" />
                        <div>
                            <code>{{ ver.imageName }}</code>
                        </div>
                    </div>

                    <div
                        v-if="ver.version !== currentVersion"
                        class="row q-gutter-x-sm q-mt-sm"
                    >
                        <q-btn
                            outline
                            size="sm"
                            color="primary"
                            label="Restore this version"
                            icon="sym_o_restore"
                            @click="() => $emit('restore', ver)"
                        />
                    </div>
                    <div
                        v-else
                        class="text-caption text-positive text-weight-bold"
                    >
                        Current Latest
                    </div>
                </q-timeline-entry>
            </q-timeline>
        </div>
    </q-drawer>
</template>

<script setup lang="ts">
import { ActionTemplatesDto } from '@api/types/actions/action-templates.dto';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    open: boolean;
    versions: ActionTemplatesDto;
}>();

const emits = defineEmits(['close', 'restore']);

const _open = ref(false);

watch(
    () => props.open,
    (value) => (_open.value = value),
);
watch(
    () => _open.value,
    (value) => {
        if (!value) emits('close');
    },
);

// Sort Descending (Newest first)
const sortedVersions = computed(() => {
    return [...props.versions.data].sort(
        (a, b) => Number(b.version ?? 0) - Number(a.version ?? 0),
    );
});

const currentVersion = computed(() => sortedVersions.value[0]?.version);
const currentName = computed(() => sortedVersions.value[0]?.name);

const formatDate = (dateString?: string | Date): string => {
    if (!dateString) return 'Unknown Date';
    return new Date(dateString).toLocaleDateString();
};

const closeDrawer = (): void => {
    _open.value = false;
};
</script>
