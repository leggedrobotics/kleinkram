<template>
    <template v-if="user">
        <title-section title="">
            <template #subtitle>
                <UserProfileBanner />
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
                    <q-tab
                        name="Projects"
                        label="Projects"
                        style="color: #222"
                    />
                    <q-tab
                        name="Settings"
                        label="Settings"
                        :disable="true"
                        style="color: #222"
                    />
                    <q-tab
                        name="Admin"
                        label="Admin"
                        :disable="user.role === UserRole.USER"
                        style="color: #222"
                    />
                </q-tabs>
            </template>
        </title-section>
        <h4>{{ tab }}</h4>
        <q-tab-panels
            v-model="tab"
            class="q-mt-lg"
            style="background: transparent"
        >
            <q-tab-panel name="Details">
                <user-profile-details />
            </q-tab-panel>
            <q-tab-panel name="Projects">
                <explorer-page-project-table
                    :url-handler="handler"
                    :my-projects="true"
                />
            </q-tab-panel>
            <q-tab-panel name="Admin">
                <admin-settings />
            </q-tab-panel>
        </q-tab-panels>
    </template>
    <template v-else>
        <div class="row flex-center">
            <q-spinner-gears size="100px" />
        </div>
    </template>
</template>

<script setup lang="ts">
import { UserRole } from '@common/enum';
import ExplorerPageProjectTable from 'components/explorer-page/explorer-page-project-table.vue';
import TitleSection from 'components/title-section.vue';
import AdminSettings from 'components/user-profile/admin-settings.vue';
import UserProfileBanner from 'components/user-profile/user-profile-banner.vue';
import UserProfileDetails from 'components/user-profile/user-profile-details.vue';
import { useHandler, useUser } from 'src/hooks/query-hooks';
import { ref } from 'vue';
import 'vue-json-pretty/lib/styles.css';

const { data: user } = useUser();
const tab = ref('Details');

const handler = useHandler();

// we need to set the creator.uuid search param in order to fetch the correct projects

handler.value.searchParams = { 'creator.uuid': user.value?.uuid ?? '' };
</script>
