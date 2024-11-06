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
                                {{ defaultGroup?.name || 'None' }}
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
            <admin-settings />
        </q-tab-panel>
    </q-tab-panels>
</template>

<script setup lang="ts">
import 'vue-json-pretty/lib/styles.css';
import TitleSection from 'components/TitleSection.vue';
import { computed, ref } from 'vue';
import ExplorerPageProjectTable from 'components/explorer_page/ExplorerPageProjectTable.vue';
import ROLE from 'src/enums/USER_ROLES';
import { useHandler, useUser } from 'src/hooks/customQueryHooks';
import AdminSettings from 'components/userProfile/AdminSettings.vue';
import { AccessGroup } from 'src/types/AccessGroup';

const { data } = useUser();
const tab = ref('Details');

const defaultGroup = computed<AccessGroup | undefined>(() => {
    return data.value?.accessGroupUsers.find(
        (group) => group.accessGroup?.inheriting,
    )?.accessGroup as AccessGroup | undefined;
});

// we need to set the creator.uuid search param in order to fetch the correct projects
const handler = useHandler();
handler.value.searchParams = { 'creator.uuid': data.value?.uuid || '' };
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
