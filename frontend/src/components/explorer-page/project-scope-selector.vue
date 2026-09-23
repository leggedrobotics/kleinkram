<template>
    <q-btn-dropdown
        dense
        flat
        class="button-border q-px-sm project-scope-selector"
        aria-label="Filter the project list"
    >
        <template #label>
            {{ PROJECT_SCOPE_LABELS[scope ?? 'all'] }}
        </template>
        <q-list>
            <q-item
                v-for="option in PROJECT_SCOPES"
                :key="option"
                v-close-popup
                clickable
                @click="() => (scope = option)"
            >
                <q-item-section>
                    {{ PROJECT_SCOPE_LABELS[option] }}
                </q-item-section>
            </q-item>
        </q-list>
    </q-btn-dropdown>
</template>
<script setup lang="ts">
import {
    PROJECT_SCOPE_LABELS,
    PROJECT_SCOPES,
    type ProjectScope,
} from 'src/types/project-scope';

const scope = defineModel<ProjectScope>();
</script>

<style scoped>
/* Comfortable touch target on phones and tablets */
@media (max-width: 1023px) {
    .project-scope-selector {
        min-height: 40px;
    }
}
</style>
