<template>
    <div>
        <h2 class="text-h5 text-md-h4 q-mt-none q-mb-md">Metadata records</h2>

        <div v-if="error" class="text-negative">
            <q-icon name="sym_o_warning" /> Failed to read metadata:
            {{ error }}
        </div>

        <div
            v-else-if="records === undefined"
            class="row items-center q-gutter-sm text-grey-7"
        >
            <q-spinner-dots size="1.5em" /> <span>Loading metadata...</span>
        </div>

        <q-list v-else bordered separator class="rounded-borders bg-white">
            <q-item v-for="group in groups" :key="group.name">
                <q-item-section>
                    <q-item-label class="text-weight-medium q-mb-xs">
                        {{ group.name }}
                    </q-item-label>
                    <MetadataValues :values="group.latest.values" />

                    <q-expansion-item
                        v-if="group.earlier.length > 0"
                        dense
                        dense-toggle
                        switch-toggle-side
                        header-class="text-grey-7 q-px-none metadata__earlier"
                        :label="earlierLabel(group.earlier.length)"
                        class="q-mt-sm"
                    >
                        <div class="text-caption text-grey-7 q-mb-sm">
                            A record cannot be changed once it is written, so a
                            recorder that updates it appends a new one under the
                            same name. The values above are from the last one.
                        </div>
                        <div
                            v-for="(record, index) in group.earlier"
                            :key="index"
                            class="metadata__earlier-record"
                        >
                            <MetadataValues :values="record.values" />
                        </div>
                    </q-expansion-item>
                </q-item-section>
            </q-item>
        </q-list>
    </div>
</template>

<script setup lang="ts">
import type { RecordingMetadata } from 'src/services/decoding-strategies/recording-insights';
import { computed, onMounted, ref } from 'vue';
import MetadataValues from './metadata-values.vue';

const properties = defineProps<{
    read: () => Promise<RecordingMetadata[]>;
}>();

// The summary only indexes metadata records; their content is read when the
// tab is first opened, one small request per record.
const records = ref<RecordingMetadata[] | undefined>(undefined);
const error = ref<string | undefined>(undefined);

interface MetadataGroup {
    name: string;
    latest: RecordingMetadata;
    /** Records of the same name written before `latest`, oldest first. */
    earlier: RecordingMetadata[];
}

/**
 * rosbag2 writes its `rosbag2` record twice: a placeholder when it opens the
 * file and the real values when it closes it. Listed side by side the two
 * look like a duplicate, so each name is shown once, with its last record.
 */
const groups = computed<MetadataGroup[]>(() => {
    const byName = new Map<string, MetadataGroup>();
    for (const record of records.value ?? []) {
        const group = byName.get(record.name);
        if (group) {
            group.earlier.push(group.latest);
            group.latest = record;
        } else {
            byName.set(record.name, {
                name: record.name,
                latest: record,
                earlier: [],
            });
        }
    }
    return [...byName.values()];
});

const earlierLabel = (count: number): string =>
    count === 1 ? '1 earlier record' : `${count.toString()} earlier records`;

onMounted(async () => {
    try {
        records.value = await properties.read();
    } catch (error_: unknown) {
        error.value = error_ instanceof Error ? error_.message : String(error_);
    }
});
</script>

<style scoped>
:deep(.metadata__earlier) {
    min-height: 28px;
    font-size: 13px;
}

.metadata__earlier-record {
    padding: 8px 0 8px 12px;
    border-left: 2px solid #e0e0e0;
    margin-bottom: 8px;
}
</style>
