<template>
    <q-drawer
        v-model="isOpen"
        side="right"
        bordered
        :behavior="$q.screen.xs ? 'mobile' : 'desktop'"
        :width="drawerWidth"
    >
        <div
            class="q-pa-lg flex row justify-between items-start q-gutter-y-sm metadata-drawer__header"
        >
            <div class="flex column justify-center">
                <h3 class="text-h5 q-ma-none text-weight-medium">Metadata</h3>
                <span class="text-subtitle2 text-grey-7 q-mt-xs"
                    >{{ mission.metadata?.length || 0 }} Metadata</span
                >
            </div>
            <div class="row items-center q-gutter-sm">
                <q-btn
                    v-if="canModify"
                    class="bg-button-secondary text-on-color"
                    unelevated
                    dense
                    padding="4px 12px"
                    icon="sym_o_edit"
                    label="Edit Metadata"
                    @click="openMetadataDialog"
                />
                <q-btn
                    flat
                    dense
                    padding="6px"
                    class="button-border"
                    icon="sym_o_close"
                    @click="closeDrawer"
                >
                    <q-tooltip>Close</q-tooltip>
                </q-btn>
            </div>
        </div>

        <q-separator />

        <div class="q-pa-none">
            <div class="column">
                <div
                    v-for="metadata in mission.metadata ?? []"
                    :key="metadata.uuid"
                    class="column metadata-item-container q-pa-lg relative-position"
                >
                    <div class="row items-center q-gutter-x-sm text-grey-8">
                        <q-icon
                            :name="getIconForDataType(metadata.type.datatype)"
                            size="16px"
                        />
                        <span class="text-caption"
                            >{{ metadata.type.name }}:</span
                        >
                    </div>

                    <div style="word-break: break-all">
                        <div
                            v-if="metadata.type.datatype === DataType.LINK"
                            class="bg-grey-1 rounded-borders q-pa-sm text-body2 cursor-pointer inline-block value-box"
                            @click="() => openLink(metadata)"
                        >
                            {{ metadata.value }}
                        </div>
                        <div
                            v-else
                            class="bg-grey-1 rounded-borders q-pa-sm text-body2 inline-block value-box"
                        >
                            {{ metadata.value }}
                        </div>

                        <div
                            class="actions-container absolute-right row items-center q-pr-lg"
                            style="opacity: 0; transition: opacity 0.2s"
                        >
                            <q-btn
                                flat
                                dense
                                :icon="
                                    copiedStates[metadata.uuid]
                                        ? 'sym_o_check'
                                        : 'sym_o_content_copy'
                                "
                                size="sm"
                                :color="
                                    copiedStates[metadata.uuid]
                                        ? 'positive'
                                        : 'grey-7'
                                "
                                class="bg-grey-1 rounded-borders q-mr-xs"
                                @click="() => copyMetadataValue(metadata)"
                            >
                                <q-tooltip>{{
                                    copiedStates[metadata.uuid]
                                        ? 'Copied!'
                                        : 'Copy Output'
                                }}</q-tooltip>
                            </q-btn>
                        </div>
                    </div>
                </div>

                <div
                    v-if="!mission.metadata || mission.metadata.length === 0"
                    class="text-grey text-center q-pa-md"
                >
                    No metadata available.
                </div>
            </div>
        </div>
    </q-drawer>
</template>

<script setup lang="ts">
import type { MetadataDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import { DataType } from '@kleinkram/shared';
import { copyToClipboard, useQuasar } from 'quasar';
import ModifyMissionMetadataDialog from 'src/dialogs/modify-mission-metadata-dialog.vue';
import { canModifyMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed, ref } from 'vue';

const props = defineProps<{
    open: boolean;
    mission: MissionWithFilesDto;
}>();

const emit = defineEmits(['update:open']);

const isOpen = computed({
    get: () => props.open,
    set: (value) => {
        emit('update:open', value);
    },
});

const closeDrawer = () => {
    isOpen.value = false;
};

const $q = useQuasar();

/** The drawer covers the full viewport on phones. */
const drawerWidth = computed(() => ($q.screen.xs ? $q.screen.width : 600));

const { data: permissions } = usePermissionsQuery();

const canModify = computed(() =>
    canModifyMission(
        props.mission.uuid,
        props.mission.project.uuid,
        permissions.value,
    ),
);

const openMetadataDialog = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: ModifyMissionMetadataDialog,
        componentProps: {
            mission: props.mission,
        },
    });
};

const openLink = (metadata: MetadataDto): void => {
    if (metadata.type.datatype === DataType.LINK) {
        const rawValue = metadata.value as
            string | Date | number | boolean | null | undefined;
        const url =
            rawValue !== undefined && rawValue !== null ? String(rawValue) : '';
        if (url) {
            window.open(url, '_blank');
        }
    }
};

const copiedStates = ref<Record<string, boolean>>({});

const copyMetadataValue = async (metadata: MetadataDto): Promise<void> => {
    let value: unknown;
    if (metadata.type.datatype === DataType.BOOLEAN) {
        value = metadata.value;
    } else {
        const rawValue = metadata.value as
            string | Date | number | boolean | null | undefined;
        value =
            rawValue !== undefined && rawValue !== null ? String(rawValue) : '';
    }
    try {
        await copyToClipboard(String(value));
        copiedStates.value[metadata.uuid] = true;
        setTimeout(() => {
            copiedStates.value[metadata.uuid] = false;
        }, 2000);
    } catch {
        // Silently fail if copy is denied
    }
};

const getIconForDataType = (datatype: DataType): string => {
    switch (datatype) {
        case DataType.STRING: {
            return 'sym_o_match_case';
        }
        case DataType.NUMBER: {
            return 'sym_o_tag';
        }
        case DataType.BOOLEAN: {
            return 'sym_o_tonality';
        }
        case DataType.DATE: {
            return 'sym_o_calendar_today';
        }
        case DataType.LOCATION: {
            return 'sym_o_location_on';
        }
        case DataType.LINK: {
            return 'sym_o_link';
        }
        default: {
            return 'sym_o_label';
        }
    }
};
</script>

<style scoped>
.metadata-drawer__header {
    height: 114px;
}

@media (max-width: 599px) {
    /* Title and buttons wrap on phones, so the header grows with them */
    .metadata-drawer__header {
        height: auto;
        padding: 16px;
    }

    .metadata-item-container {
        padding: 16px;
    }

    /* Touch devices have no hover, so the copy button is always visible */
    .actions-container {
        opacity: 1 !important;
        position: static !important;
        padding-right: 0 !important;
    }
}

.button-border {
    border: 1px solid #e0e0e0;
}
.button-border:hover {
    background: #f5f5f5;
}
.metadata-item-container {
    transition: background-color 0.2s;
}
.metadata-item-container::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 24px;
    right: 24px;
    height: 1px;
    background-color: rgba(0, 0, 0, 0.12);
}
.metadata-item-container:last-child::after {
    display: none;
}
.metadata-item-container:hover {
    background-color: #f5f5f5;
}
.metadata-item-container:hover .actions-container {
    opacity: 1 !important;
}
.value-box {
    transition: background-color 0.2s;
}
.metadata-item-container:hover .value-box {
    background-color: #e0e0e0 !important;
}
</style>
