<template>
    <div>
        <div class="col-9">
            <label>Metadata</label>
            <q-select
                ref="selectReference"
                v-model="selected"
                outlined
                dense
                required
                multiple
                input-debounce="100"
                :options="filteredTags"
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
                    v-for="tag in selected"
                    :key="tag.uuid"
                    class="selected-tag-item"
                >
                    <div class="tag-name">{{ tag.name }}</div>
                    <div class="tag-actions">
                        <!-- the font-size is necessary for consistnet font sizes for production builds -->
                        <q-icon
                            :name="icon(tag.datatype)"
                            class="q-mr-sm"
                            style="font-size: 24px"
                        />
                        <!-- the font-size is necessary for consistnet font sizes for production builds -->
                        <q-icon
                            class="q-ml-sm text-red cursor-pointer"
                            name="sym_o_delete"
                            style="font-size: 24px"
                            @click="() => removeTag(tag)"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { TagTypeDto } from '@api/types/tags/tags.dto';
import { DataType } from '@common/enum';
import { QSelect } from 'quasar';
import { useFilteredTag } from 'src/hooks/query-hooks';
import { icon } from 'src/services/generic';
import { computed, ref, watch } from 'vue';

const selectReference = ref<QSelect | undefined>(undefined);
const tagSearch = ref('');
const selectedDataType = ref(DataType.ANY);
const properties = defineProps<{
    selected: TagTypeDto[];
}>();

const selected = ref<TagTypeDto[]>([...properties.selected]);

const emits = defineEmits(['update:selected']);

watch(
    selected,
    (newValue: TagTypeDto[]) => {
        // Corrected type here
        emits('update:selected', newValue);
    },
    { deep: true },
);

const { data: tags } = useFilteredTag(tagSearch.value, selectedDataType.value);

const onInputUpdate = (value: string): void => {
    tagSearch.value = value;
};

const removeTag = (tag: TagTypeDto): void => {
    const index = selected.value.findIndex((t) => t.uuid === tag.uuid);
    if (index !== -1) {
        selected.value.splice(index, 1);
    }
};

const filteredTags = computed(() => {
    if (!tags.value?.data) return;
    return tags.value.data.filter(
        (tag) =>
            !selected.value.some(
                (selectedTag) => selectedTag.uuid === tag.uuid,
            ),
    );
});

watch(
    selected,
    (newValue: TagTypeDto[]) => {
        emits('update:selected', newValue);
        if (selectReference.value) {
            selectReference.value.hidePopup(); // Close the dropdown after selection
        }
    },
    { deep: true },
);
</script>

<style scoped>
.selected-tag-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 8px;
}

.tag-name {
    flex-grow: 1;
}

.tag-actions {
    display: flex;
    align-items: center;
}
</style>
