<template>
    <div style="margin: auto 0" v-if="!!user">
        <q-btn
            round
            flat
            :style="
                user.role === USER_ROLES.ADMIN ? 'border: 3px solid red' : ''
            "
        >
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

            <q-menu auto-close style="width: 280px; padding: 8px">
                <q-list style="gap: 4px; display: flex; flex-direction: column">
                    <q-item
                        clickable
                        v-close-popup
                        @click="navigateTo(ROUTES.USER_PROFILE.path)"
                    >
                        <q-item-section avatar>
                            <q-icon name="sym_o_person" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-section>{{ user['name'] }}</q-item-section>
                        </q-item-section>
                    </q-item>

                    <q-separator />

                    <q-item disabled>
                        <q-item-section avatar>
                            <q-icon name="sym_o_storage" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Storage</q-item-label>
                        </q-item-section>
                    </q-item>

                    <q-item disabled>
                        <q-item-section avatar>
                            <q-icon name="sym_o_settings" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Settings</q-item-label>
                        </q-item-section>
                    </q-item>

                    <q-item clickable @click="logout" class="text-error">
                        <q-item-section avatar>
                            <q-icon
                                name="sym_o_logout"
                                style="rotate: 180deg"
                            />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Log out</q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-menu>
        </q-btn>
    </div>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { logout } from 'src/services/auth';
import ROUTES from 'src/router/routes';
import USER_ROLES from 'src/enums/USER_ROLES';
import { useUser } from 'src/hooks/customQueryHooks';

const $router = useRouter();

const navigateTo = (path: string) => {
    $router.push(path);
};

const { data: user } = useUser();
</script>

<style scoped>
.q-item__section--avatar {
    min-width: 0;
}
</style>
