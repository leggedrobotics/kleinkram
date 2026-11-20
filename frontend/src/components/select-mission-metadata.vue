<template>
    <div
        v-if="requiredMetadataTypes.length + optionalMetadataTypes.length > 0"
        class="metadata-grid"
    >
        <template
            v-for="(group, groupIndex) in [
                requiredMetadataTypes,
                optionalMetadataTypes,
            ]"
            :key="groupIndex"
        >
            <div
                v-if="
                    groupIndex === 1 &&
                    requiredMetadataTypes.length > 0 &&
                    optionalMetadataTypes.length > 0
                "
                class="metadata-grid__separator"
                role="separator"
            />
            <div
                v-for="metadataType in group"
                :key="metadataType.uuid"
                class="metadata-grid__row"
            >
                <div class="metadata-grid__name">
                    <div class="metadata-grid__label">
                        {{ metadataType.name
                        }}<span
                            v-if="isRequired(metadataType)"
                            class="text-error"
                            aria-hidden="true"
                            >*</span
                        >
                    </div>
                    <div class="metadata-grid__type">
                        {{ metadataType.datatype }}
                    </div>
                </div>

                <div class="metadata-grid__input">
                    <q-input
                        v-if="metadataType.datatype !== DataType.BOOLEAN"
                        v-model="localMetadataValues[metadataType.uuid]"
                        :aria-label="metadataType.name"
                        :aria-required="isRequired(metadataType)"
                        outlined
                        dense
                        color="button-primary"
                        hide-bottom-space
                        no-error-icon
                        lazy-rules
                        :placeholder="
                            METADATA_VALUE_EXAMPLES[metadataType.datatype]
                        "
                        :rules="rulesFor(metadataType)"
                        :error="
                            serverErrors[metadataType.uuid] ? true : undefined
                        "
                        :error-message="serverErrors[metadataType.uuid]"
                        :type="
                            // @ts-ignore
                            DataType_InputType[metadataType.datatype] ?? 'text'
                        "
                    />
                    <q-field
                        v-else
                        :model-value="localMetadataValues[metadataType.uuid]"
                        borderless
                        dense
                        hide-bottom-space
                        no-error-icon
                        lazy-rules
                        :rules="
                            isRequired(metadataType)
                                ? [isAnswered(metadataType.name)]
                                : []
                        "
                    >
                        <div
                            role="radiogroup"
                            :aria-label="metadataType.name"
                            class="boolean-choice"
                        >
                            <q-btn
                                v-for="choice in [true, false]"
                                :key="String(choice)"
                                flat
                                no-caps
                                dense
                                role="radio"
                                :aria-checked="
                                    localMetadataValues[metadataType.uuid] ===
                                    (choice as unknown as string)
                                "
                                :label="choice ? 'True' : 'False'"
                                class="boolean-choice__option"
                                :class="{
                                    'boolean-choice__option--selected':
                                        localMetadataValues[
                                            metadataType.uuid
                                        ] === (choice as unknown as string),
                                }"
                                @click="
                                    () => setBoolean(metadataType.uuid, choice)
                                "
                            />
                        </div>
                    </q-field>
                </div>

                <div class="metadata-grid__action">
                    <q-btn
                        v-if="!isRequired(metadataType)"
                        flat
                        round
                        dense
                        icon="sym_o_delete"
                        class="metadata-grid__remove"
                        :aria-label="`Remove ${metadataType.name}`"
                        @click="() => removeMetadataType(metadataType.uuid)"
                    >
                        <q-tooltip>Remove</q-tooltip>
                    </q-btn>
                </div>
            </div>
        </template>
    </div>

    <span
        class="metadata-add"
        :class="{
            'metadata-add--below':
                requiredMetadataTypes.length + optionalMetadataTypes.length > 0,
        }"
    >
        <q-btn
            flat
            no-caps
            dense
            icon="sym_o_add"
            label="Add metadata"
            class="text-link-primary"
            :disable="availableAdditionalMetadataTypes.length === 0"
        >
            <q-menu v-model="menuOpen" @hide="clearMenuSearch">
                <div class="q-pa-sm">
                    <q-input
                        v-model="menuSearch"
                        no-error-icon
                        dense
                        outlined
                        autofocus
                        color="button-primary"
                        placeholder="Search metadata"
                        aria-label="Search metadata"
                        autocomplete="off"
                        @keydown.enter.prevent="addFirstResult"
                    >
                        <template #prepend>
                            <q-icon name="sym_o_search" size="20px" />
                        </template>
                    </q-input>
                </div>
                <q-list class="metadata-menu__list">
                    <q-item
                        v-for="metadataType in menuMetadataTypes"
                        :key="metadataType.uuid"
                        clickable
                        @click="() => pickMetadataType(metadataType)"
                    >
                        <q-item-section>{{ metadataType.name }}</q-item-section>
                        <q-item-section side class="metadata-menu__type">
                            {{ metadataType.datatype }}
                        </q-item-section>
                    </q-item>
                    <q-item v-if="menuMetadataTypes.length === 0">
                        <q-item-section class="text-secondary">
                            No metadata types found
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-menu>
        </q-btn>
        <q-tooltip v-if="availableAdditionalMetadataTypes.length === 0">
            All metadata types added
        </q-tooltip>
    </span>
</template>

<script setup lang="ts">
import type { MetadataTypeDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import { DataType } from '@kleinkram/shared';
import {
    getMetadataValueError,
    METADATA_VALUE_EXAMPLES,
} from '@kleinkram/validation/frontend';
import { useAllMetadataTypes, useProjectQuery } from 'src/hooks/query-hooks';
import { required } from 'src/services/form-rules';
import { computed, Ref, ref, watch } from 'vue';

const properties = defineProps<{
    metadataValues: Record<string, string>;
    projectUuid: string;
}>();

const emit = defineEmits(['update:metadataValues']);

/**
 * Errors the server reported per metadata type uuid; an error is dropped
 * as soon as its value is edited
 */
const serverErrors = defineModel<Record<string, string>>('serverErrors', {
    default: () => ({}),
});

/** Required, then the format of the type; checked on blur and on submit */
const rulesFor = (
    metadataType: MetadataTypeDto,
): ((value: string) => true | string)[] => [
    ...(isRequired(metadataType) ? [required(metadataType.name)] : []),
    (value: string) =>
        getMetadataValueError(metadataType.datatype, value) ?? true,
];

// Create a shallow copy of metadataValues to make it editable locally
const localMetadataValues = ref({ ...properties.metadataValues });
const additionalMetadataTypes: Ref<MetadataTypeDto[]> = ref<MetadataTypeDto[]>(
    [],
);

// Keep local copy in sync with prop changes from parent
watch(
    () => properties.metadataValues,
    (newValue) => {
        const isDifferent =
            JSON.stringify(newValue) !==
            JSON.stringify(localMetadataValues.value);
        if (isDifferent) {
            localMetadataValues.value = { ...newValue };
        }
    },
    { deep: true, immediate: true },
);

// Watch for changes in localMetadataValues and emit them back to the parent
let lastValues = { ...localMetadataValues.value };
watch(
    localMetadataValues,
    (newValue) => {
        emit('update:metadataValues', newValue);
        // an edited value is checked again, the server's error no longer applies
        const edited = Object.keys(serverErrors.value).filter(
            (uuid) => newValue[uuid] !== lastValues[uuid],
        );
        if (edited.length > 0) {
            serverErrors.value = Object.fromEntries(
                Object.entries(serverErrors.value).filter(
                    ([uuid]) => !edited.includes(uuid),
                ),
            );
        }
        lastValues = { ...newValue };
    },
    { deep: true },
);

const { data: metadataTypes } = useAllMetadataTypes();
const { data: project } = useProjectQuery(
    computed(() => properties.projectUuid),
);

watch(
    () => ({
        project: project.value,
        metadataTypes: metadataTypes.value,
        metadataTypeKeys: Object.keys(localMetadataValues.value).join(','),
    }),
    ({ project: newProject, metadataTypes: newMetadataTypes }) => {
        if (newProject && newMetadataTypes) {
            additionalMetadataTypes.value = [];
            for (const metadataTypeUUID of Object.keys(
                localMetadataValues.value,
            )) {
                if (
                    !newProject.requiredMetadataTypes
                        .map(
                            (requiredType: MetadataTypeDto) =>
                                requiredType.uuid,
                        )
                        .includes(metadataTypeUUID)
                ) {
                    const newMetadataType: MetadataTypeDto | undefined =
                        newMetadataTypes.find(
                            (metadataType: MetadataTypeDto) =>
                                metadataType.uuid === metadataTypeUUID,
                        );
                    if (newMetadataType === undefined) continue;
                    additionalMetadataTypes.value.push(newMetadataType);
                }
            }
        }
    },
    { immediate: true },
);

const availableAdditionalMetadataTypes: Ref<MetadataTypeDto[]> = computed(
    () => {
        if (metadataTypes.value === undefined) return [];
        let usedMetadataTypeUUIDs: string[] = [];
        if (project.value) {
            usedMetadataTypeUUIDs = project.value.requiredMetadataTypes.map(
                (metadataType) => metadataType.uuid,
            );
        }
        const addedMetadataTypeUUIDs = new Set(
            additionalMetadataTypes.value.map(
                (metadataType) => metadataType.uuid,
            ),
        );
        return metadataTypes.value.filter(
            (metadataType: MetadataTypeDto) =>
                !usedMetadataTypeUUIDs.includes(metadataType.uuid) &&
                !addedMetadataTypeUUIDs.has(metadataType.uuid),
        );
    },
);
// eslint-disable-next-line @typescript-eslint/naming-convention
const DataType_InputType = {
    [DataType.STRING]: 'text',
    [DataType.NUMBER]: 'number',
    [DataType.BOOLEAN]: 'checkbox',
    [DataType.DATE]: 'date',
    [DataType.LOCATION]: 'text',
};

const menuOpen = ref(false);
const menuSearch = ref<string | number | null>('');
const menuMetadataTypes = computed(() => {
    const needle = String(menuSearch.value ?? '').toLowerCase();
    return availableAdditionalMetadataTypes.value.filter((metadataType) =>
        metadataType.name.toLowerCase().includes(needle),
    );
});

/** Adds the type and closes the menu (focus returns to "+ Add metadata") */
const pickMetadataType = (metadataType: MetadataTypeDto): void => {
    addMetadataType(metadataType);
    menuOpen.value = false;
};

const clearMenuSearch = (): void => {
    menuSearch.value = '';
};

/** Enter in the search adds the first match */
const addFirstResult = (): void => {
    const first = menuMetadataTypes.value[0];
    if (first) pickMetadataType(first);
};

const addMetadataType = (metadataType: MetadataTypeDto): void => {
    additionalMetadataTypes.value.push(metadataType);
    if (!(metadataType.uuid in localMetadataValues.value)) {
        // Use undefined for BOOLEAN so that the toggle starts in the neutral/undefined state
        localMetadataValues.value[metadataType.uuid] =
            metadataType.datatype === DataType.BOOLEAN
                ? (undefined as unknown as string)
                : '';
    }
};

const isRequired = (metadataType: MetadataTypeDto): boolean => {
    if (requiredMetadataTypeUUIDs.value) {
        const requiredUUIDs = requiredMetadataTypeUUIDs.value;
        return requiredUUIDs.includes(metadataType.uuid);
    } else {
        return true;
    }
};

const requiredMetadataTypeUUIDs = computed(() =>
    project.value?.requiredMetadataTypes.map(
        (metadataType) => metadataType.uuid,
    ),
);

const requiredMetadataTypes = computed<MetadataTypeDto[]>(
    () => project.value?.requiredMetadataTypes ?? [],
);
const optionalMetadataTypes = computed<MetadataTypeDto[]>(
    () => additionalMetadataTypes.value,
);

const removeMetadataType = (metadataTypeUUID: string): void => {
    const index = additionalMetadataTypes.value.findIndex(
        (metadataType) => metadataType.uuid === metadataTypeUUID,
    );
    if (index !== -1) {
        additionalMetadataTypes.value.splice(index, 1);
    }
    const { [metadataTypeUUID]: _, ...rest } = localMetadataValues.value;
    localMetadataValues.value = rest;
};

/** A BOOLEAN value is stored as true/false, like the toggle did before */
const setBoolean = (uuid: string, value: boolean): void => {
    localMetadataValues.value[uuid] = value as unknown as string;
};

/** Rule for a required BOOLEAN field: True or False must be chosen */
const isAnswered =
    (label: string) =>
    (value: unknown): true | string =>
        value === true || value === false || `${label} is required.`;
</script>
<style scoped>
.metadata-menu__list {
    max-height: 280px;
    overflow-y: auto;
}

/* the datatype, right-aligned: small monospace $text-secondary */
.metadata-menu__type {
    color: #525252;
    font-family: monospace;
    font-size: 11px;
    text-transform: uppercase;
}

/* an invalid value: a 2px $support-error border */
.metadata-grid__input :deep(.q-field--error .q-field__control:after) {
    border-width: 2px;
}

.metadata-type-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.metadata-grid {
    display: grid;
    grid-template-columns: minmax(120px, 200px) minmax(0, 1fr) 32px;
    gap: 8px 16px;
    align-items: center;
}

/* the cells of a row are items of the grid, so all rows share the columns */
.metadata-grid__row {
    display: contents;
}

.metadata-grid__separator {
    grid-column: 1 / -1;
    height: 1px;
    background: #e0e0e0; /* $border-subtle-00 */
}

.metadata-grid__name {
    min-width: 0;
    overflow-wrap: anywhere;
}

/* $text-primary */
.metadata-grid__label {
    color: #161616;
    font-size: 14px;
    line-height: 18px;
}

/* $text-secondary */
.metadata-grid__type {
    color: #525252;
    font-family: monospace;
    font-size: 11px;
    line-height: 16px;
    text-transform: uppercase;
}

.metadata-grid__input {
    min-width: 0;
}

.metadata-grid__action {
    display: flex;
    justify-content: center;
}

/* $icon-secondary */
.metadata-grid__remove {
    color: #525252;
}

/* an unset boolean is neutral grey ($icon-on-color-disabled), not red */
.metadata-grid__input :deep(.q-toggle__inner--indet) {
    color: #8d8d8d;
}

.metadata-add {
    display: inline-block;
}

.metadata-add--below {
    margin-top: 8px;
}

@media (max-width: 599px) {
    .metadata-grid {
        grid-template-columns: minmax(0, 1fr) 32px;
    }

    .metadata-grid__name {
        grid-column: 1 / -1;
        margin-top: 8px;
    }
}

/* True / False choice: like the expiration chips, selected is $button-secondary */
.boolean-choice {
    display: flex;
    gap: 8px;
}

.boolean-choice__option {
    min-width: 72px;
    height: 40px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: #eeeeee;
    color: #161616;
}

.boolean-choice__option--selected {
    border-color: #393939;
    background: #393939;
    color: #ffffff;
}
</style>
