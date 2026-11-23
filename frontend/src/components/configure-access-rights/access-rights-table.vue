<template>
    <div v-if="accessRights.length > 0" class="row-grid">
        <div
            v-for="(group, index) in accessRights"
            :key="group.uuid"
            class="row-grid__row"
        >
            <div v-if="index > 0" class="row-grid__separator" />
            <div class="row-grid__name">
                <div class="row-grid__label">{{ group.name }}</div>
                <div class="row-grid__type">{{ typeLine(group) }}</div>
            </div>

            <div class="row-grid__setting">
                <q-select
                    no-error-icon
                    :model-value="group.rights"
                    :options="rightOptions(group)"
                    :aria-label="`Rights of ${group.name}`"
                    option-disable="disable"
                    emit-value
                    map-options
                    outlined
                    dense
                    color="button-primary"
                    hide-bottom-space
                    @update:model-value="
                        (right: AccessGroupRights) =>
                            emit('update-rights', group, right)
                    "
                >
                    <template #option="scope">
                        <q-item v-bind="scope.itemProps">
                            <q-item-section>
                                {{ scope.opt.label }}
                            </q-item-section>
                            <q-tooltip v-if="scope.opt.disable">
                                Project must have at least one group with Delete
                                rights.
                            </q-tooltip>
                        </q-item>
                    </template>
                </q-select>
            </div>

            <div class="row-grid__action">
                <q-btn
                    flat
                    round
                    dense
                    icon="sym_o_delete"
                    class="row-grid__remove"
                    :aria-label="`Remove ${group.name}`"
                    :disable="isDeleteDisabled(group)"
                    @click="() => emit('remove', group)"
                >
                    <q-tooltip>
                        {{
                            isDeleteDisabled(group)
                                ? 'Cannot remove the last group with Delete rights.'
                                : 'Remove'
                        }}
                    </q-tooltip>
                </q-btn>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { DefaultRightDto } from '@kleinkram/api-dto/types/access-control/default-right.dto';
import { AccessGroupRights, AccessGroupType } from '@kleinkram/shared';
import { accessGroupRightsList } from 'src/enums/access-group-rights-list';
import { getAccessRightDescription } from 'src/services/generic';
import { computed } from 'vue';

const properties = defineProps<{
    accessRights: DefaultRightDto[];
}>();

const emit = defineEmits<{
    (
        event: 'update-rights',
        group: DefaultRightDto,
        right: AccessGroupRights,
    ): void;
    (event: 'remove', group: DefaultRightDto): void;
}>();

/** "USER" for a user's own group, "GROUP · 12" for other groups */
const typeLine = (group: DefaultRightDto): string =>
    group.type === AccessGroupType.PRIMARY
        ? 'User'
        : `Group · ${String(group.memberCount)}`;

/**
 * There is only one global rule for the access rights of a project:
 * **There must always be at least one group with DELETE rights.**
 *
 * The same global rule is enforced in the backend (see access.service.ts). We implement it here as well to provide immediate feedback to the user and prevent unnecessary API calls that would be rejected by the backend.
 */

// Count how many groups currently have DELETE rights
const deleteGroupCount = computed(() => {
    return properties.accessRights.filter(
        (g) => g.rights === AccessGroupRights.DELETE,
    ).length;
});

//Prevent downgrading the last group with DELETE rights
const isDisabledRightOption = (
    group: DefaultRightDto,
    rightOption: AccessGroupRights,
): boolean => {
    // If they are trying to select a right lower than DELETE...
    if (
        group.rights === AccessGroupRights.DELETE &&
        rightOption < AccessGroupRights.DELETE
    ) {
        // ...disable it if this is the ONLY group with DELETE rights
        return deleteGroupCount.value <= 1;
    }
    return false;
};

const rightOptions = (
    group: DefaultRightDto,
): { label: string; value: AccessGroupRights; disable: boolean }[] =>
    accessGroupRightsList.map((option) => ({
        label: getAccessRightDescription(option),
        value: option,
        disable: isDisabledRightOption(group, option),
    }));

//Prevent removing the last group with DELETE rights
const isDeleteDisabled = (group: DefaultRightDto): boolean => {
    if (group.rights === AccessGroupRights.DELETE) {
        return deleteGroupCount.value <= 1;
    }
    return false;
};
</script>

<style scoped>
/* rows share their columns: name | rights | remove */
.row-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 112px 32px;
    gap: 8px 16px;
    align-items: center;
}

.row-grid__row {
    display: contents;
}

/* $border-subtle-00 */
.row-grid__separator {
    grid-column: 1 / -1;
    height: 1px;
    background: #e0e0e0;
}

.row-grid__name {
    min-width: 0;
    overflow-wrap: anywhere;
}

/* $text-primary */
.row-grid__label {
    color: #161616;
    font-size: 14px;
    line-height: 18px;
}

/* $text-secondary */
.row-grid__type {
    color: #525252;
    font-family: monospace;
    font-size: 11px;
    line-height: 16px;
    text-transform: uppercase;
}

.row-grid__setting {
    min-width: 0;
}

.row-grid__action {
    display: flex;
    justify-content: center;
}

/* $icon-secondary */
.row-grid__remove {
    color: #525252;
}

@media (max-width: 599px) {
    .row-grid {
        grid-template-columns: minmax(0, 1fr) 32px;
    }

    .row-grid__name {
        grid-column: 1 / -1;
        margin-top: 8px;
    }
}
</style>
