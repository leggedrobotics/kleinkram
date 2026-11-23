<template>
    <div>
        <template v-if="selected.length > 0">
            <p class="required-metadata__intro">
                Every mission in this project must fill in this metadata.
            </p>
            <ul class="required-metadata__list">
                <li
                    v-for="metadataType in selected"
                    :key="metadataType.uuid"
                    class="required-metadata__row"
                >
                    <div class="required-metadata__name">
                        <div class="required-metadata__label">
                            {{ metadataType.name }}
                        </div>
                        <div class="required-metadata__type">
                            {{ metadataType.datatype }}
                        </div>
                    </div>
                    <q-btn
                        flat
                        round
                        dense
                        icon="sym_o_delete"
                        class="required-metadata__remove"
                        :aria-label="`Remove ${metadataType.name}`"
                        @click="() => removeMetadataType(metadataType)"
                    />
                </li>
            </ul>
        </template>

        <div :class="{ 'required-metadata__empty': selected.length === 0 }">
            <template v-if="selected.length === 0">
                <div class="text-weight-bold">No required metadata</div>
                <div>Missions can be created without extra metadata.</div>
            </template>

            <q-btn
                flat
                no-caps
                dense
                icon="sym_o_add"
                label="Add metadata"
                class="text-link-primary required-metadata__add"
            >
                <q-menu
                    v-model="menuOpen"
                    class="required-metadata__menu"
                    @show="onMenuShow"
                    @hide="onMenuHide"
                >
                    <div class="q-pa-sm">
                        <q-input
                            v-model="nameSearch"
                            no-error-icon
                            dense
                            outlined
                            autofocus
                            debounce="300"
                            color="button-primary"
                            placeholder="Search metadata"
                            aria-label="Search metadata"
                            @keydown.enter.prevent="addFirstResult"
                        >
                            <template #prepend>
                                <q-icon name="sym_o_search" size="20px" />
                            </template>
                        </q-input>
                    </div>
                    <q-list class="required-metadata__options">
                        <q-item
                            v-for="metadataType in filteredMetadataTypes"
                            :key="metadataType.uuid"
                            clickable
                            @click="() => pickMetadataType(metadataType)"
                        >
                            <q-item-section>
                                <q-item-label>{{
                                    metadataType.name
                                }}</q-item-label>
                            </q-item-section>
                            <q-item-section
                                side
                                class="required-metadata__option-type"
                            >
                                {{ metadataType.datatype }}
                            </q-item-section>
                        </q-item>
                        <q-item
                            v-if="
                                isFetching && filteredMetadataTypes.length === 0
                            "
                        >
                            <q-item-section>
                                <q-spinner size="20px" />
                            </q-item-section>
                        </q-item>
                        <q-item v-else-if="filteredMetadataTypes.length === 0">
                            <q-item-section class="text-secondary">
                                No metadata types found
                            </q-item-section>
                        </q-item>
                        <q-item
                            v-if="canCreateType"
                            clickable
                            class="required-metadata__new-type"
                            @click="createMetadataType"
                        >
                            <q-item-section
                                avatar
                                class="required-metadata__icon"
                            >
                                <q-icon name="sym_o_add" size="20px" />
                            </q-item-section>
                            <q-item-section>New metadata type…</q-item-section>
                        </q-item>
                    </q-list>
                </q-menu>
            </q-btn>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { MetadataTypeDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import { DataType } from '@kleinkram/shared';
import { Dialog } from 'quasar';
import CreateMetadataTypeDialog from 'src/dialogs/create-metadata-type-dialog.vue';
import {
    canCreateProject,
    useFilteredMetadataTypes,
    usePermissionsQuery,
} from 'src/hooks/query-hooks';
import { computed, ref, watch } from 'vue';

const nameSearch = ref<string | number | null>('');
const searchText = computed(() => String(nameSearch.value ?? ''));
const selectedDataType = ref(DataType.ANY);
const properties = defineProps<{
    selected: MetadataTypeDto[];
}>();

const selected = ref<MetadataTypeDto[]>([...properties.selected]);

const emits = defineEmits(['update:selected']);

watch(
    selected,
    (newValue: MetadataTypeDto[]) => {
        emits('update:selected', newValue);
    },
    { deep: true },
);

const { data: metadataTypes, isFetching } = useFilteredMetadataTypes(
    searchText,
    selectedDataType,
);

const removeMetadataType = (metadataType: MetadataTypeDto): void => {
    const index = selected.value.findIndex((t) => t.uuid === metadataType.uuid);
    if (index !== -1) {
        selected.value.splice(index, 1);
    }
};

const addMetadataType = (metadataType: MetadataTypeDto): void => {
    if (selected.value.some((t) => t.uuid === metadataType.uuid)) return;
    selected.value.push(metadataType);
};

const filteredMetadataTypes = computed<MetadataTypeDto[]>(() =>
    (metadataTypes.value?.data ?? []).filter(
        (metadataType) =>
            !selected.value.some(
                (selectedType) => selectedType.uuid === metadataType.uuid,
            ),
    ),
);

// creating metadata types needs the same rights as creating projects
const { data: permissions } = usePermissionsQuery();
const canCreateType = computed(() => canCreateProject(permissions.value));

const menuOpen = ref(false);

/** Adds the type and closes the menu (focus returns to "+ Add metadata") */
const pickMetadataType = (metadataType: MetadataTypeDto): void => {
    addMetadataType(metadataType);
    menuOpen.value = false;
};

/** Enter in the search adds the first match */
const addFirstResult = (): void => {
    const first = filteredMetadataTypes.value[0];
    if (first) pickMetadataType(first);
};

/** Opens the create dialog; the new type is required right away */
const createMetadataType = (): void => {
    menuOpen.value = false;
    Dialog.create({ component: CreateMetadataTypeDialog }).onOk(
        (created?: MetadataTypeDto) => {
            if (created) addMetadataType(created);
        },
    );
};

// every opening starts with the full list
const onMenuShow = (): void => {
    nameSearch.value = '';
};
const onMenuHide = (): void => {
    nameSearch.value = '';
};
</script>

<style scoped>
/* the datatype under each option, like the rows */
.required-metadata__option-type {
    color: #525252;
    font-family: monospace;
    font-size: 11px;
    text-transform: uppercase;
}

/* $link-primary, set apart from the existing types */
.required-metadata__new-type {
    border-top: 1px solid #e0e0e0;
    color: #0f62fe;
}

/* $text-secondary */
.required-metadata__intro {
    margin: 0 0 8px;
    color: #525252;
}

.required-metadata__list {
    margin: 0;
    padding: 0;
    list-style: none;
}

/* $border-subtle-00 separators between the rows */
.required-metadata__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 32px;
    gap: 16px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #e0e0e0;
}

.required-metadata__row:first-child {
    border-top: 1px solid #e0e0e0;
}

.required-metadata__name {
    min-width: 0;
    overflow-wrap: anywhere;
}

/* $text-primary */
.required-metadata__label {
    color: #161616;
    font-size: 14px;
    line-height: 18px;
}

/* $text-secondary */
.required-metadata__type {
    color: #525252;
    font-family: monospace;
    font-size: 11px;
    line-height: 16px;
    text-transform: uppercase;
}

/* $icon-secondary */
.required-metadata__remove {
    color: #525252;
}

/* dashed $button-disabled border */
.required-metadata__empty {
    padding: 16px;
    border: 1px dashed #c6c6c6;
    border-radius: 4px;
    color: #161616;
}

.required-metadata__add {
    margin-top: 8px;
}

.required-metadata__options {
    max-height: 280px;
    min-width: 260px;
    overflow-y: auto;
}

.required-metadata__icon {
    min-width: 32px;
}
</style>
