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
            <q-item
                v-for="(record, index) in records"
                :key="`${record.name}:${String(index)}`"
            >
                <q-item-section>
                    <q-item-label class="text-weight-medium q-mb-xs">
                        {{ record.name }}
                    </q-item-label>
                    <div
                        v-if="Object.keys(record.values).length > 0"
                        class="metadata__values"
                    >
                        <template
                            v-for="(value, key) in record.values"
                            :key="key"
                        >
                            <div class="text-grey-7">{{ key }}</div>
                            <div class="metadata__value">{{ value }}</div>
                        </template>
                    </div>
                    <q-item-label v-else caption>No values</q-item-label>
                </q-item-section>
            </q-item>
        </q-list>
    </div>
</template>

<script setup lang="ts">
import type { RecordingMetadata } from 'src/services/decoding-strategies/recording-insights';
import { onMounted, ref } from 'vue';

const properties = defineProps<{
    read: () => Promise<RecordingMetadata[]>;
}>();

// The summary only indexes metadata records; their content is read when the
// tab is first opened, one small request per record.
const records = ref<RecordingMetadata[] | undefined>(undefined);
const error = ref<string | undefined>(undefined);

onMounted(async () => {
    try {
        records.value = await properties.read();
    } catch (error_: unknown) {
        error.value = error_ instanceof Error ? error_.message : String(error_);
    }
});
</script>

<style scoped>
.metadata__values {
    display: grid;
    grid-template-columns: minmax(120px, max-content) 1fr;
    column-gap: 24px;
    row-gap: 2px;
    font-size: 13.5px;
}

.metadata__value {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

@media (max-width: 599px) {
    .metadata__values {
        grid-template-columns: 1fr;
    }
}
</style>
