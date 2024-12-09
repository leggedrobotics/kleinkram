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

        <template #buttons>
            <button-group>
                <q-btn
                    class="button-border"
                    flat
                    color="primary"
                    icon="sym_o_link"
                    label="Mission"
                    @click="openMission"
                >
                    <q-tooltip> Analyze Actions</q-tooltip>
                </q-btn>
            </button-group>
        </template>
    </title-section>

    <q-tab-panels v-model="tab" class="q-mt-lg" style="background: transparent">
        <q-tab-panel name="info">
            <div v-if="action" class="q-table-container">
                <table class="q-table__table">
                    <tbody>
                        <tr>
                            <td class="q-table__cell">Docker Image</td>
                            <td class="q-table__cell">
                                {{ action.template.imageName }}

                                <span
                                    v-if="action.image.repoDigests?.[0]"
                                    style="color: #525252; font-size: 0.8em"
                                >
                                    <br />
                                    {{ action.image.repoDigests?.[0] }}
                                </span>
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
                                {{ action?.creator?.name }}
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">State</td>
                            <td class="q-table__cell">
                                <ActionBadge v-if="action" :action="action" />
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

                                <span
                                    v-if="!action?.template.command"
                                    style="color: #525252; font-size: 0.8em"
                                >
                                    No command specified
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Entrypoint</td>
                            <td class="q-table__cell">
                                {{ action?.template.entrypoint }}

                                <span
                                    v-if="!action?.template.entrypoint"
                                    style="color: #525252; font-size: 0.8em"
                                >
                                    No entrypoint specified
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">Access Rights</td>
                            <td class="q-table__cell">
                                {{
                                    accessGroupRightsMap[
                                        action.template.accessRights
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
                                {{ action.worker.hostname || 'N/A' }}
                            </td>
                        </tr>
                        <tr v-if="action">
                            <td class="q-table__cell">Runtime:</td>
                            <td class="q-table__cell">
                                {{
                                    (action.updatedAt.getTime() -
                                        action.createdAt.getTime()) /
                                    1000
                                }}
                                seconds
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell">
                                Hardware Requirements:
                            </td>
                            <td class="q-table__cell">
                                <div v-if="action.template">
                                    Cores: {{ action.template.cpuCores }}<br />
                                    RAM:
                                    {{ action.template.cpuMemory }} GB<br />
                                    min vRAM:
                                    <template
                                        v-if="action?.template.gpuMemory >= 0"
                                    >
                                        {{ action.template.gpuMemory }} GB
                                    </template>
                                    <template v-else>
                                        no GPU requested
                                    </template>
                                    <br />
                                </div>
                                <div v-else>N/A</div>
                            </td>
                        </tr>

                        <tr>
                            <td class="q-table__cell">Project / Mission:</td>
                            <td class="q-table__cell">
                                {{ action.mission?.project?.name }} /
                                {{ action.mission?.name }}
                            </td>
                        </tr>

                        <tr>
                            <td class="q-table__cell">Artifact Files:</td>
                            <td class="q-table__cell">
                                <q-btn
                                    v-if="
                                        action.artifacts ===
                                        ArtifactState.UPLOADED
                                    "
                                    label="Open"
                                    flat
                                    dense
                                    padding="6px"
                                    color="icon-secondary"
                                    class="button-border"
                                    icon="sym_o_link"
                                    @click="openArtifact"
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
                        :key="log.timestamp.toISOString()"
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
                                >{{
                                    formatDate(new Date(log.timestamp), true)
                                }}</span
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
                                >{{
                                    formatDate(new Date(log.timestamp), true)
                                }}</span
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
                    :key="log.url"
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

import { useRoute, useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { actionDetails } from 'src/services/queries/action';
import { computed, ref } from 'vue';
import { formatDate } from '../services/dateFormating';
import { accessGroupRightsMap } from 'src/services/generic';
import { ArtifactState } from '@common/enum';
import ROUTES from '../router/routes';
import { ActionDto } from '@api/types/actions/action.dto';
import ButtonGroup from '@components/buttons/button-group.vue';
import TitleSection from '@components/title-section.vue';
import ActionBadge from '@components/action-badge.vue';

const tab = ref('info');

const $route = useRoute();
const $router = useRouter();

const { data: action } = useQuery<ActionDto>({
    queryKey: ['missions_action', $route.params.id],
    queryFn: () => actionDetails($route.params.id as string),
    refetchInterval: 5000,
});

const artifactState = computed(() => {
    switch (action.value?.artifacts ?? ArtifactState.ERROR) {
        case ArtifactState.UPLOADING: {
            return 'Uploading...';
        }
        case ArtifactState.ERROR: {
            return 'N/A';
        }
        case ArtifactState.AWAITING_ACTION: {
            return 'Waiting action completion...';
        }
        // No default
    }
    return 'N/A';
});

const openArtifact = (): void => {
    if (action.value === undefined) return;
    window.open(action.value.artifactUrl, '_blank');
};

const openMission = async (): Promise<void> => {
    if (action.value === undefined) return;

    await $router.push({
        name: ROUTES.FILES.routeName,
        params: {
            project_uuid: action.value.mission.project.uuid,
            mission_uuid: action.value.mission.uuid,
        },
    });
};
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
