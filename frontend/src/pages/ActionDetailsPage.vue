<template>
    <title-section title="Action Details">
        <template #tabs>
            <q-tabs
                v-model="tab"
                dense
                class="text-grey"
                align="left"
                active-color="primary"
            >
                <q-tab name="info" label="Details" style="color: #222" />
                <q-tab name="logs" label="Logs" style="color: #222" />
            </q-tabs>
        </template>
    </title-section>

    <q-tab-panels v-model="tab" class="q-mt-lg" style="background: transparent">
        <q-tab-panel name="info">
            <div class="q-table-container">
                <table class="q-table__table">
                    <tbody>
                        <tr>
                            <td class="q-table__cell">Docker Image</td>
                            <td class="q-table__cell">
                                {{ data?.template.image.name }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Name</td>
                            <td class="q-table__cell">
                                {{ data?.template.name }}
                                v{{ data?.template.version }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Created By</td>
                            <td class="q-table__cell">
                                {{ data?.createdBy.name }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">State</td>
                            <td class="q-table__cell">
                                {{ data?.state }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">State Reason</td>
                            <td class="q-table__cell">
                                {{ data?.state_cause }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Submitted At:</td>
                            <td class="q-table__cell">
                                {{ data?.createdAt }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Last Updated At:</td>
                            <td class="q-table__cell">
                                {{ data?.updatedAt }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Runner CPU Model:</td>
                            <td class="q-table__cell">
                                {{ data?.runner_cpu_model }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Runner Hostname:</td>
                            <td class="q-table__cell">
                                {{ data?.runner_hostname }}
                            </td>
                        </tr>
                        <tr v-if="data && data?.getRuntimeInMS() != 0">
                            <td class="q-table__cell">Runtime:</td>
                            <td class="q-table__cell">
                                {{ data?.getRuntimeInMS() / 1000 }} seconds
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </q-tab-panel>

        <q-tab-panel name="logs">
            <q-card
                class="q-pa-lg"
                style="background-color: #f4f4f4"
                flat
                bordered
            >
                <q-card-section class="flex column q-pa-none">
                    <div
                        v-for="log in data?.logs"
                        :key="log.timestamp"
                        class="flex justify-start q-pb-xs"
                        style="
                            font-family: monospace;
                            color: #222222;
                            font-size: 0.8em;
                        "
                    >
                        <template v-if="log.type == 'stdout'">
                            <span
                                class="q-pr-sm"
                                style="user-select: none; color: #525252"
                                >{{ log.timestamp }}</span
                            >
                            <span
                                class="q-pr-sm"
                                style="user-select: none; color: #525252"
                            >
                                [{{ log.type }}]
                            </span>

                            <span
                                style="margin-left: -250px; padding-left: 250px"
                            >
                                {{ log.message.replaceAll(' ', '\u00a0') }}
                            </span>
                        </template>

                        <template v-else>
                            <span
                                class="q-pr-sm"
                                style="user-select: none; color: #fd7c7cff"
                                >{{ log.timestamp }}</span
                            >
                            <span
                                class="q-pr-sm"
                                style="user-select: none; color: #fd7c7cff"
                            >
                                [{{ log.type }}]
                            </span>

                            <span
                                style="
                                    margin-left: -250px;
                                    padding-left: 250px;
                                    color: #ff3c3c;
                                "
                            >
                                {{ log.message.replaceAll(' ', '\u00a0') }}
                            </span>
                        </template>
                    </div>
                </q-card-section>
            </q-card>
        </q-tab-panel>
    </q-tab-panels>
</template>

<script setup lang="ts">
import 'vue-json-pretty/lib/styles.css';

// print the id of the action mission (extracted from the route)
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { actionDetails } from 'src/services/queries/action';
import { Action } from 'src/types/Action';
import TitleSection from 'components/TitleSection.vue';
import { ref } from 'vue';

const tab = ref('info');

const $route = useRoute();

const { data } = useQuery<Action>({
    queryKey: ['missions_action', $route.params.id],
    queryFn: () => actionDetails($route.params.id as string),
});
</script>

<style>
.q-table-container {
    width: 100%;
    border: 1px solid #e0e0e0;
    border-bottom: none;
}

.q-table__table {
    width: 100%;
    border-collapse: collapse;
}

.q-table__cell {
    padding: 8px;
    border-bottom: none; /* Remove border to match page background */
    outline: black;
    border-bottom: 1px solid #e0e0e0;
    border-right: 1px solid #e0e0e0;
}

.q-table__cell:last-child {
    border-right: none;
}
</style>
