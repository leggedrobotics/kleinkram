<script setup lang="ts">
import { getUser, isAuthenticated, logout } from 'src/services/auth';
import ROUTES from 'src/router/routes';
import { useRouter } from 'vue-router';

const is_authenticated = await isAuthenticated();
const user = await getUser();

const $router = useRouter();
const navigateTo = (path: string) => {
    $router.push(path);
};
</script>

<template>
    <q-tabs>
        <q-route-tab :to="ROUTES.LOGIN.path" v-if="!is_authenticated">
            Sign in
        </q-route-tab>

        <div class="flex row justify-end" v-else>
            <q-btn flat color="white" class="q-mr-lg">
                <div
                    style="
                        background-color: rgb(54 122 199);
                        margin: 0 1px 0 0;
                        height: 36px;
                    "
                >
                    <q-icon
                        name="sym_o_add"
                        class="q-mx-xs"
                        style="height: 36px"
                    />
                    <span class="q-mr-md"> New </span>
                </div>
                <q-icon
                    style="background-color: rgb(54 122 199); height: 36px"
                    name="sym_o_arrow_drop_down"
                    class="q-my-sm"
                />

                <q-menu auto-close style="width: 280px">
                    <q-list>
                        <q-item clickable disable>
                            <q-item-section avatar>
                                <q-icon name="sym_o_sell" />
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>Create New Tag Type</q-item-label>
                            </q-item-section>
                        </q-item>
                        <q-item clickable disable>
                            <q-item-section avatar>
                                <q-icon name="sym_o_tactic" />
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>Create New Project</q-item-label>
                            </q-item-section>
                        </q-item>
                        <q-item clickable disable>
                            <q-item-section avatar>
                                <q-icon name="sym_o_explore" />
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>Create New Mission</q-item-label>
                            </q-item-section>
                        </q-item>
                        <q-item clickable disable>
                            <q-item-section avatar>
                                <q-icon name="sym_o_note_add" />
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>Upload New File</q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-menu>
            </q-btn>

            <q-btn
                href="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
                round
                flat
                color="grey-8"
                target="_blank"
                icon="sym_o_help"
            >
                <q-tooltip> Support</q-tooltip>
            </q-btn>

            <q-btn round flat>
                <q-avatar
                    size="32px"
                    v-if="!!user['avatarUrl'] && user['avatarUrl'] !== ''"
                >
                    <img
                        :src="user['avatarUrl']"
                        referrerpolicy="no-referrer"
                        alt="avatar"
                    />
                </q-avatar>

                <q-avatar size="36px" v-else>
                    <q-icon name="sym_o_account_circle" />
                </q-avatar>

                <q-menu auto-close style="width: 280px">
                    <q-list>
                        <q-item
                            clickable
                            v-close-popup
                            @click="navigateTo(ROUTES.USER_PROFILE.path)"
                        >
                            <q-item-section avatar></q-item-section>
                            <q-item-section>
                                <q-item-section
                                    >{{ user['name'] }}
                                </q-item-section>
                            </q-item-section>
                        </q-item>
                        <q-item clickable @click="logout">
                            <q-item-section avatar>
                                <q-icon name="sym_o_logout" />
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>Sign out</q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-menu>
            </q-btn>
        </div>
    </q-tabs>
</template>
