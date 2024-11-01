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
                <q-tab
                    name="logs"
                    label="Logs"
                    style="color: #222"
                    :disable="!action?.logs || action?.logs.length === 0"
                >
                    <q-tooltip
                        v-if="!action?.logs || action?.logs.length === 0"
                    >
                        <span>No logs available</span>
                    </q-tooltip>
                </q-tab>
                <q-tab
                    name="auditLogs"
                    label="Audit Logs"
                    style="color: #222"
                    :disable="
                        !action?.auditLogs || action?.auditLogs.length === 0
                    "
                >
                    <q-tooltip
                        v-if="
                            !action?.auditLogs || action?.auditLogs.length === 0
                        "
                    >
                        <span>No audit logs available</span>
                    </q-tooltip>
                </q-tab>
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
                                {{ action?.image?.repoDigests?.[0] }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Name</td>
                            <td class="q-table__cell">
                                {{ action?.template.name }}
                                v{{ action?.template.version }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Created By</td>
                            <td class="q-table__cell">
                                {{ action?.createdBy.name }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">State</td>
                            <td class="q-table__cell">
                                <ActionBadge :action="action" v-if="action" />
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">State Reason</td>
                            <td class="q-table__cell">
                                {{ action?.stateCause }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Command</td>
                            <td class="q-table__cell">
                                {{ action?.template.command }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Entrypoint</td>
                            <td class="q-table__cell">
                                {{ action?.template.entrypoint }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Access Rights</td>
                            <td class="q-table__cell">
                                {{
                                    accessGroupRightsMap[
                                        action?.template.accessRights
                                    ]
                                }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Submitted At:</td>
                            <td class="q-table__cell">
                                {{
                                    action?.createdAt
                                        ? formatDate(action?.createdAt)
                                        : 'N/A'
                                }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Last Updated At:</td>
                            <td class="q-table__cell">
                                {{
                                    action?.updatedAt
                                        ? formatDate(action?.updatedAt)
                                        : 'N/A'
                                }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Runner CPU Model:</td>
                            <td class="q-table__cell">
                                {{ action?.worker?.cpuModel || 'N/A' }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Runner Hostname:</td>
                            <td class="q-table__cell">
                                {{ action?.worker?.hostname || 'N/A' }}
                            </td>
                        </tr>
                        <tr v-if="action && action?.getRuntimeInMS() != 0">
                            <td class="q-table__cell">Runtime:</td>
                            <td class="q-table__cell">
                                {{ action?.getRuntimeInMS() / 1000 }} seconds
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">
                                Hardware Requirements:
                            </td>
                            <td class="q-table__cell">
                                <div v-if="action?.template">
                                    Cores: {{ action?.template.cpuCores }}<br />
                                    RAM:
                                    {{ action?.template.cpuMemory }} GB<br />
                                    min vRAM:
                                    <template
                                        v-if="action?.template.gpuMemory >= 0"
                                    >
                                        {{ action?.template.gpuMemory }} GB
                                    </template>
                                    <template v-else>no GPU requested</template>
                                    <br />
                                </div>
                                <div v-else>N/A</div>
                            </td>
                        </tr>

                        <tr>
                            <td class="q-table__cell">Artifact Files:</td>
                            <td class="q-table__cell">
                                <q-btn
                                    v-if="
                                        action?.artifacts ===
                                        ArtifactState.UPLOADED
                                    "
                                    label="Open"
                                    flat
                                    dense
                                    padding="6px"
                                    color="icon-secondary"
                                    class="button-border"
                                    icon="sym_o_link"
                                    @click="
                                        () =>
                                            openArtifactUrl(action?.artifactUrl)
                                    "
                                />
                                <div v-else>
                                    {{ artifactState }}
                                </div>
                                <br />
                                <span style="color: #525252; font-size: 0.8em">
                                    Artifacts are only be stored for 3 months.
                                    Please download them if you need them for
                                    longer.
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </q-tab-panel>

        <q-tab-panel name="logs">
            <p style="max-width: 650px; color: #525252; font-size: 0.8em">
                We capture the stdout and stderr of the action execution. In the
                following we list all the logs generated by the action container
                during the execution of the action.
            </p>

            <q-card
                class="q-pa-lg"
                style="background-color: #f4f4f4"
                flat
                bordered
            >
                <q-card-section class="flex column q-pa-none">
                    <div
                        v-for="log in action?.logs"
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

        <q-tab-panel name="auditLogs">
            <p style="max-width: 650px; color: #525252; font-size: 0.8em">
                Audit log help to understand which elements are being accessed
                by the action. This is useful for debugging and security
                purposes. In the following we list all endpoints called by the
                kleinkram CLI during the execution of the action.
            </p>

            <q-card
                class="q-pa-lg"
                style="background-color: #f4f4f4"
                flat
                bordered
            >
                <div
                    v-for="log in action?.auditLogs"
                    :key="log"
                    class="flex justify-start q-pb-xs"
                    style="
                        font-family: monospace;
                        color: #222222;
                        font-size: 0.8em;
                    "
                >
                    <span
                        class="q-pr-sm"
                        style="user-select: none; color: #525252"
                        >{{ log.method }}</span
                    >

                    <span>
                        {{ log.url }}
                    </span>
                </div>
            </q-card>
        </q-tab-panel>
    </q-tab-panels>
</template>

<script setup lang="ts">
import 'vue-json-pretty/lib/styles.css';

import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { actionDetails } from 'src/services/queries/action';
import { Action } from 'src/types/Action';
import TitleSection from 'components/TitleSection.vue';
import { computed, ComputedRef, Ref, ref } from 'vue';
import ActionBadge from 'components/ActionBadge.vue';
import { ArtifactState } from 'src/enums/ARTIFACT_STATE';
import { formatDate, parseDate } from '../services/dateFormating';
import { accessGroupRightsMap } from 'src/services/generic';

const tab = ref('info');

const $route = useRoute();

const { data } = useQuery<Action>({
    queryKey: ['missions_action', $route.params.id],
    queryFn: () => actionDetails($route.params.id as string),
    refetchInterval: 5_000,
});

const action: ComputedRef<Action> = computed(
    () => data.value,
) as ComputedRef<Action>;

function openArtifactUrl(url: string) {
    window.open(url, '_blank');
}

const artifactState = computed(() => {
    if (action.value?.artifacts === ArtifactState.UPLOADING) {
        return 'Uploading...';
    } else if (action.value?.artifacts === ArtifactState.ERROR) {
        return 'N/A';
    } else if (action.value?.artifacts === ArtifactState.AWAITING_ACTION) {
        return 'Waiting action completion...';
    }
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
