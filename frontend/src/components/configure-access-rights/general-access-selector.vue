<template>
    <div class="text-caption text-weight-medium text-secondary q-mt-lg q-mb-sm">
        GENERAL ACCESS
    </div>

    <div class="row items-center no-wrap q-pa-md general-access">
        <q-icon
            :name="current.icon"
            size="20px"
            class="q-mr-md general-access__avatar"
        />

        <div class="col column items-start">
            <q-btn-dropdown
                flat
                dense
                no-caps
                class="button-border q-px-sm text-weight-medium"
                :label="current.label"
                :disable="disable"
                aria-label="General access"
            >
                <q-list style="max-width: 420px">
                    <q-item
                        v-for="option in options"
                        :key="option.label"
                        v-close-popup
                        clickable
                        :active="option.isPublic === isPublic"
                        active-class="general-access__option--selected"
                        @click="() => (isPublic = option.isPublic)"
                    >
                        <q-item-section avatar>
                            <q-icon :name="option.icon" />
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
            <span class="text-caption text-secondary q-mt-xs">
                {{ current.description }}
            </span>
            <span v-if="disable" class="text-caption text-secondary">
                Only users with delete rights on the project can change general
                access.
            </span>
        </div>

        <q-chip
            v-if="isPublic"
            square
            text-color="primary"
            icon="sym_o_public"
            class="text-weight-medium q-ml-md general-access__tag"
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

/** Changing general access needs delete rights on the project. */
const { disable } = defineProps<{ disable?: boolean }>();

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

/* all icons $icon-primary; no green, it is not a status */
.general-access__avatar {
    background: #e0e0e0;
    border-radius: 50%;
    padding: 6px;
    color: #161616;
}

/* read-only public access: a neutral grey tag ($tag-background-gray) */
.general-access__tag {
    background: #e0e0e0;
}

/* the selected option: light blue row like single-choice dropdowns */
.general-access__option--selected {
    background: #edf5ff;
    color: #0043ce;
}
</style>
