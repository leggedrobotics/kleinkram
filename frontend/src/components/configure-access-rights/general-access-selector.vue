<template>
    <div class="text-caption text-weight-medium text-grey-8 q-mt-lg q-mb-sm">
        GENERAL ACCESS
    </div>

    <div
        class="row items-center no-wrap q-pa-md general-access"
        :class="{ 'general-access--public': isPublic }"
    >
        <q-icon
            :name="current.icon"
            size="20px"
            class="q-mr-md general-access__avatar"
            :class="{ 'general-access__avatar--public': isPublic }"
        />

        <div class="col column items-start">
            <q-btn-dropdown
                flat
                dense
                no-caps
                class="button-border q-px-sm text-weight-medium"
                :label="current.label"
                aria-label="General access"
            >
                <q-list style="max-width: 420px">
                    <q-item
                        v-for="option in options"
                        :key="option.label"
                        v-close-popup
                        clickable
                        :active="option.isPublic === isPublic"
                        active-class="bg-grey-2 text-black"
                        @click="() => (isPublic = option.isPublic)"
                    >
                        <q-item-section avatar>
                            <q-icon
                                :name="option.icon"
                                :color="option.isPublic ? 'green-8' : 'grey-8'"
                            />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label class="text-weight-medium">
                                {{ option.label }}
                            </q-item-label>
                            <q-item-label caption>
                                {{ option.description }}
                            </q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-btn-dropdown>
            <span class="text-caption text-grey-8 q-mt-xs">
                {{ current.description }}
            </span>
        </div>

        <q-chip
            v-if="isPublic"
            square
            outline
            color="grey-8"
            icon-right="sym_o_lock"
            class="text-weight-medium q-ml-md"
            :label="getAccessRightDescription(AccessGroupRights.READ)"
        >
            <q-tooltip>
                Public access is always read-only. To let someone upload or
                edit, add them to the list above.
            </q-tooltip>
        </q-chip>
    </div>
</template>

<script setup lang="ts">
import { AccessGroupRights } from '@kleinkram/shared';
import { getAccessRightDescription } from 'src/services/generic';
import { computed } from 'vue';

const isPublic = defineModel<boolean>({ required: true });

const options = [
    {
        isPublic: false,
        icon: 'sym_o_lock',
        label: 'Restricted',
        description:
            'Only the users and groups listed above can open this project.',
    },
    {
        isPublic: true,
        icon: 'sym_o_public',
        label: 'All Kleinkram users',
        description:
            'Everyone who can log in can find, view and download this project, including users who sign up later.',
    },
];

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const current = computed(() => options[isPublic.value ? 1 : 0]!);
</script>

<style scoped>
.general-access {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}

.general-access--public {
    border-color: #bfe3c9;
    background: #f6fbf7;
}

.general-access__avatar {
    background: #eeeeee;
    border-radius: 50%;
    padding: 6px;
}

.general-access__avatar--public {
    background: #dff3e4;
    color: #1b7a3a;
}
</style>
