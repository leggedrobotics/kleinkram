<template>
    <div>
        <div class="col-12 col-md-9">
            <label>Metadata</label>
            <q-select
                ref="selectReference"
                v-model="selected"
                outlined
                dense
                required
                multiple
                input-debounce="100"
                :options="filteredMetadataTypes"
                class="full-width"
                option-label="label"
                option-value="value"
                @input-value="onInputUpdate"
            >
                <template #no-option>
                    <q-item>
                        <q-item-section class="text-grey">
                            No results
                        </q-item-section>
                    </q-item>
                </template>
                <template #option="{ itemProps, opt }">
                    <q-item v-bind="itemProps">
                        <q-item-section>
                            <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component, vue/no-v-html -->
                            <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component, vue/no-v-html -->
                            <q-item-label v-html="opt.name" />
                        </q-item-section>
                        <q-item-section side>
                            <q-icon
                                :name="icon(opt.datatype)"
                                class="q-mr-sm"
                            />
                        </q-item-section>
                    </q-item>
                </template>

                <span
                    class="text-placeholder absolute"
                    style="line-height: 40px"
                >
                    Select Metadata
                </span>
                <template #selected-item />
            </q-select>

            <div v-if="selected.length > 0" class="q-mt-md">
                <div
                    v-for="metadataType in selected"
                    :key="metadataType.uuid"
                    class="selected-metadata-type-item"
                >
                    <div class="metadata-type-name">
                        {{ metadataType.name }}
                    </div>
                    <div class="metadata-type-actions">
                        <!-- the font-size is necessary for consistnet font sizes for production builds -->
                        <q-icon
                            :name="icon(metadataType.datatype)"
                            class="q-mr-sm"
                            style="font-size: 24px"
                        />
                        <!-- the font-size is necessary for consistnet font sizes for production builds -->
                        <q-icon
                            class="q-ml-sm text-red cursor-pointer"
                            name="sym_o_delete"
                            style="font-size: 24px"
                            @click="() => removeMetadataType(metadataType)"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { MetadataTypeDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import { DataType } from '@kleinkram/shared';
import { QSelect } from 'quasar';
import { useFilteredMetadataTypes } from 'src/hooks/query-hooks';
import { icon } from 'src/services/generic';
import { computed, ref, watch } from 'vue';

const selectReference = ref<QSelect | undefined>(undefined);
const nameSearch = ref('');
const selectedDataType = ref(DataType.ANY);
const properties = defineProps<{
    selected: MetadataTypeDto[];
}>();

const selected = ref<MetadataTypeDto[]>([...properties.selected]);

const emits = defineEmits(['update:selected']);

watch(
    selected,
    (newValue: MetadataTypeDto[]) => {
        // Corrected type here
        emits('update:selected', newValue);
    },
    { deep: true },
);

const { data: metadataTypes } = useFilteredMetadataTypes(
    nameSearch.value,
    selectedDataType.value,
);

const onInputUpdate = (value: string): void => {
    nameSearch.value = value;
};

const removeMetadataType = (metadataType: MetadataTypeDto): void => {
    const index = selected.value.findIndex((t) => t.uuid === metadataType.uuid);
    if (index !== -1) {
        selected.value.splice(index, 1);
    }
};

const filteredMetadataTypes = computed(() => {
    if (!metadataTypes.value?.data) return;
    return metadataTypes.value.data.filter(
        (metadataType) =>
            !selected.value.some(
                (selectedType) => selectedType.uuid === metadataType.uuid,
            ),
    );
});

watch(
    selected,
    (newValue: MetadataTypeDto[]) => {
        emits('update:selected', newValue);
        if (selectReference.value) {
            selectReference.value.hidePopup(); // Close the dropdown after selection
        }
    },
    { deep: true },
);
</script>

<style scoped>
.selected-metadata-type-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 8px;
}

.metadata-type-name {
    flex-grow: 1;
}

.metadata-type-actions {
    display: flex;
    align-items: center;
}
</style>
