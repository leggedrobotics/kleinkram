<template>
    <q-drawer
        v-model="isOpen"
        side="right"
        bordered
        behavior="desktop"
        :width="600"
    >
        <div
            class="q-pa-lg flex row justify-between items-start"
            style="height: 114px"
        >
            <div class="flex column justify-center">
                <h3 class="text-h5 q-ma-none text-weight-medium">Metadata</h3>
                <span class="text-subtitle2 text-grey-7 q-mt-xs"
                    >{{ mission.tags?.length || 0 }} Metadata</span
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
                    @click="openTagsDialog"
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
                    v-for="tag in mission.tags ?? []"
                    :key="tag.uuid"
                    class="column tag-item-container q-pa-lg relative-position"
                >
                    <div class="row items-center q-gutter-x-sm text-grey-8">
                        <q-icon
                            :name="getIconForDataType(tag.type.datatype)"
                            size="16px"
                        />
                        <span class="text-caption">{{ tag.type.name }}:</span>
                    </div>

                    <div style="word-break: break-all">
                        <div
                            v-if="tag.type.datatype === DataType.LINK"
                            class="bg-grey-1 rounded-borders q-pa-sm text-body2 cursor-pointer inline-block value-box"
                            @click="() => openLink(tag)"
                        >
                            {{ tag.valueAsString || tag.value }}
                        </div>
                        <div
                            v-else
                            class="bg-grey-1 rounded-borders q-pa-sm text-body2 inline-block value-box"
                        >
                            {{
                                tag.type.datatype === DataType.BOOLEAN
                                    ? tag.value
                                    : tag.valueAsString || tag.value
                            }}
                        </div>

                        <div
                            class="actions-container absolute-right row items-center q-pr-lg"
                            style="opacity: 0; transition: opacity 0.2s"
                        >
                            <q-btn
                                flat
                                dense
                                icon="sym_o_content_copy"
                                size="sm"
                                color="grey-7"
                                class="bg-grey-1 rounded-borders q-mr-xs"
                                @click="() => copyTagValue(tag)"
                            >
                                <q-tooltip>Copy Output</q-tooltip>
                            </q-btn>
                        </div>
                    </div>
                </div>

                <div
                    v-if="!mission.tags || mission.tags.length === 0"
                    class="text-grey text-center q-pa-md"
                >
                    No tags available.
                </div>
            </div>
        </div>
    </q-drawer>
</template>

<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import type { TagDto } from '@kleinkram/api-dto/types/tags/tags.dto';
import { DataType } from '@kleinkram/shared';
import { copyToClipboard, Notify, useQuasar } from 'quasar';
import ModifyMissionTagsDialog from 'src/dialogs/modify-mission-tags-dialog.vue';
import { canModifyMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

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
const { data: permissions } = usePermissionsQuery();

const canModify = computed(() =>
    canModifyMission(
        props.mission.uuid,
        props.mission.project.uuid,
        permissions.value,
    ),
);

const openTagsDialog = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: ModifyMissionTagsDialog,
        componentProps: {
            mission: props.mission,
        },
    });
};

const openLink = (tag: TagDto): void => {
    if (tag.type.datatype === DataType.LINK) {
        window.open(tag.valueAsString, '_blank');
    }
};

const copyTagValue = async (tag: TagDto): Promise<void> => {
    const value =
        tag.type.datatype === DataType.BOOLEAN
            ? tag.value
            : tag.valueAsString || tag.value;
    try {
        await copyToClipboard(String(value));
        Notify.create({
            message: 'Copied to clipboard',
            color: 'positive',
            timeout: 2000,
        });
    } catch {
        Notify.create({
            message: 'Failed to copy',
            color: 'negative',
            timeout: 2000,
        });
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
.button-border {
    border: 1px solid #e0e0e0;
}
.button-border:hover {
    background: #f5f5f5;
}
.tag-item-container {
    transition: background-color 0.2s;
}
.tag-item-container::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 24px;
    right: 24px;
    height: 1px;
    background-color: rgba(0, 0, 0, 0.12);
}
.tag-item-container:last-child::after {
    display: none;
}
.tag-item-container:hover {
    background-color: #f5f5f5;
}
.tag-item-container:hover .actions-container {
    opacity: 1 !important;
}
.value-box {
    transition: background-color 0.2s;
}
.tag-item-container:hover .value-box {
    background-color: #e0e0e0 !important;
}
</style>
