<template>
    <q-header bordered class="bg-white text-grey-8">
        <q-toolbar style="height: 56px">
            <div>
                <q-btn
                    flat
                    dense
                    round
                    icon="sym_o_menu"
                    v-show="$q.screen.lt.md"
                >
                    <q-menu auto-close style="width: 280px">
                        <q-list>
                            <q-item
                                v-for="item in main_menu"
                                :key="item.title"
                                clickable
                                :to="item.to"
                            >
                                <q-item-section avatar>
                                    <q-icon
                                        :name="item.icon"
                                        style="font-weight: bold"
                                    />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label
                                        >{{ item.title }}
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
            </div>

            <q-toolbar-title
                shrink
                class="cursor-pointer flex row q-mr-xl"
                style="height: 56px"
                @click="$router.push('/')"
            >
                <div style="height: 56px">
                    <img src="logoRSL.png" style="height: 28px; margin: 14px" />
                </div>
                <div class="flex column justify-center" style="height: 56px">
                    <span
                        style="
                            margin-right: 30px;
                            font-weight: 600;
                            font-size: 16px;
                            line-height: 18px;
                        "
                    >
                        Kleinkram
                    </span>
                    <span style="font-size: 10px; line-height: 12px"
                        >by Robotics Systems Lab</span
                    >
                </div>
            </q-toolbar-title>

            <q-tabs v-show="$q.screen.gt.sm" inline-label>
                <q-route-tab
                    no-caps
                    v-for="item in main_menu"
                    :key="item.title"
                    :label="item.title"
                    :to="item.to"
                    :icon="item.icon"
                />
            </q-tabs>

            <q-space />
            <Suspense>
                <ProfileComponent />
            </Suspense>
        </q-toolbar>
    </q-header>
</template>

<script setup lang="ts">
import ROUTES from 'src/router/routes';
import ProfileComponent from 'components/HeaderMenuRight.vue';

const main_menu = [
    { title: 'Explorer', icon: 'sym_o_table_chart', to: ROUTES.EXPLORER.path },
    {
        title: 'Datatable',
        icon: 'sym_o_table_rows_narrow',
        to: ROUTES.DATATABLE.path,
    },
    { title: 'Upload', icon: 'sym_o_upload', to: ROUTES.UPLOAD.path },
    { title: 'Actions', icon: 'sym_o_analytics', to: ROUTES.ACTION.path },
    {
        title: 'Access Groups',
        icon: 'sym_o_lock',
        to: ROUTES.ACCESS_GROUPS.path,
    },
];
</script>
