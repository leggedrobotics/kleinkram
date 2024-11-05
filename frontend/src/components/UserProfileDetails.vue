<template>
    <title-section title="">
        <template #subtitle>
            <div class="row">
                <q-img
                    :src="data?.avatarUrl"
                    style="width: 100px; height: 100px; border-radius: 50%"
                />
                <div class="q-ml-md">
                    <h2
                        class="text-h3"
                        style="margin-bottom: 5px; margin-top: 10px"
                    >
                        {{ data?.name }}
                    </h2>
                    <p class="text-subtitle2" style="color: #58585c">
                        {{ data?.email }}
                    </p>
                </div>
            </div>
        </template>
        <template #tabs>
            <q-tabs
                v-model="tab"
                dense
                class="text-grey"
                align="left"
                active-color="primary"
            >
                <q-tab name="Details" label="Details" style="color: #222" />
                <q-tab name="Projects" label="Projects" style="color: #222" />
                <q-tab
                    name="Settings"
                    label="Settings"
                    :disable="true"
                    style="color: #222"
                />
                <q-tab
                    name="Admin"
                    label="Admin"
                    :disable="data?.role === ROLE.USER"
                    style="color: #222"
                />
            </q-tabs>
        </template>
    </title-section>
    <h4>{{ tab }}</h4>
    <q-tab-panels v-model="tab" class="q-mt-lg" style="background: transparent">
        <q-tab-panel name="Details">
            <div class="q-table-container">
                <table class="q-table__table">
                    <tbody>
                        <tr>
                            <td class="q-table__cell first-column">Name:</td>
                            <td class="q-table__cell">{{ data?.name }}</td>
                        </tr>
                        <tr>
                            <td class="q-table__cell first-column">Email:</td>
                            <td class="q-table__cell">{{ data?.email }}</td>
                        </tr>
                        <tr>
                            <td class="q-table__cell first-column">Role:</td>
                            <td class="q-table__cell">
                                <q-chip>{{ data?.role }}</q-chip>
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell first-column">UUID:</td>
                            <td class="q-table__cell">
                                <q-chip>
                                    {{ data?.uuid }}
                                </q-chip>
                            </td>
                        </tr>
                        <tr>
                            <td class="q-table__cell first-column">
                                Default Group:
                            </td>
                            <td class="q-table__cell">
                                {{ defaultGroup?.name }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </q-tab-panel>
        <q-tab-panel name="Projects">
            <explorer-page-project-table :url_handler="handler" />
        </q-tab-panel>
        <q-tab-panel name="Admin">
            <div class="row">
                <div style="width: 300px">
                    <q-btn
                        label="Reset Minio Tagging"
                        class="button-border bg-button-primary full-width"
                        @click="resetMinioTagging"
                        icon="sym_o_sell"
                        flat
                    />
                    <div>
                        This will delete the Minio tags for all files in the
                        system and then regenerate them based on the current DB
                        state. This action cannot be undone. There is no
                        confirmation!
                    </div>
                </div>
                <div style="width: 300px; margin-left: 20px">
                    <q-btn
                        label="Recompute File Sizes"
                        class="button-border bg-button-primary full-width"
                        @click="resetFileSizes"
                        icon="sym_o_expand"
                        flat
                    />
                    <div>
                        This will recompute the file sizes in the database by
                        asking Minio for the size of each file. This action
                        cannot be undone. There is no confirmation!
                    </div>
                </div>
            </div>
        </q-tab-panel>
    </q-tab-panels>
</template>

<script setup lang="ts">
import 'vue-json-pretty/lib/styles.css';
import { getUser } from 'src/services/auth';
import TitleSection from 'components/TitleSection.vue';
import { ref } from 'vue';
import ExplorerPageProjectTable from 'components/explorer_page/ExplorerPageProjectTable.vue';
import { QueryHandler } from 'src/services/QueryHandler';
import ROLE from 'src/enums/USER_ROLES';
import axios from 'src/api/axios';
import { useHandler } from 'src/hooks/customQueryHooks';

const data = await getUser();
const tab = ref('Details');

const defaultGroup = data?.accessGroupUsers.find(
    (group) => group.accessGroup?.inheriting,
)?.accessGroup;
const handler = useHandler();
handler.value.searchParams = { 'creator.uuid': data?.uuid || '' };

async function resetMinioTagging() {
    await axios.post('file/resetMinioTags');
}

async function resetFileSizes() {
    await axios.post('file/recomputeFileSizes');
}
</script>
<style>
.q-table-container {
    max-width: 500px; /* Adjust this value to make the table narrower or wider */
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

.first-column {
    width: 130px;
}
</style>
