<template>
    <div class="column q-gutter-y-xs">
        <label class="text-weight-bold">File Health</label>
        <q-select
            v-model="healthReference"
            :options="fileHealthOptions"
            outlined
            dense
            clearable
            bg-color="white"
            placeholder="Select File Health"
        >
            <template #selected-item="scope">
                <q-chip
                    v-if="scope.opt"
                    :color="fileHealthColor(scope.opt)"
                    :style="`color: ${fileHealthTextColor(scope.opt)}; font-size: smaller`"
                >
                    {{ scope.opt }}
                </q-chip>
            </template>
            <template #option="scope">
                <q-item
                    v-ripple
                    clickable
                    v-bind="scope.itemProps"
                    dense
                    @click="() => scope.toggleOption(scope.opt)"
                >
                    <q-item-section>
                        <div>
                            <q-chip
                                dense
                                :color="fileHealthColor(scope.opt)"
                                :style="`color: ${fileHealthTextColor(scope.opt)}`"
                                class="full-width"
                            >
                                {{ scope.opt }}
                            </q-chip>
                        </div>
                    </q-item-section>
                </q-item>
            </template>
        </q-select>
    </div>
</template>

<script setup lang="ts">
import { HealthStatus } from '@kleinkram/shared';
import { MissionFilterState } from 'src/composables/use-mission-file-filter';
import { PropType, toRef } from 'vue';

const props = defineProps({
    state: {
        type: Object as PropType<MissionFilterState>,
        required: true,
    },
});

const healthReference = toRef(props.state, 'health');

const fileHealthOptions = [
    HealthStatus.HEALTHY,
    HealthStatus.UPLOADING,
    HealthStatus.UNHEALTHY,
];

const fileHealthColor = (health: string): string => {
    switch (health as HealthStatus) {
        case HealthStatus.HEALTHY: {
            return 'positive';
        }
        case HealthStatus.UPLOADING: {
            return 'warning';
        }
        case HealthStatus.UNHEALTHY: {
            return 'negative';
        }
        default: {
            return 'grey';
        }
    }
};

const fileHealthTextColor = (health: string): string => {
    switch (health as HealthStatus) {
        case HealthStatus.HEALTHY: {
            return 'white';
        }
        case HealthStatus.UPLOADING: {
            return 'black';
        }
        case HealthStatus.UNHEALTHY: {
            return 'white';
        }
        default: {
            return 'black';
        }
    }
};
</script>
