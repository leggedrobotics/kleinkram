<template>
    <div v-if="!!user" style="margin: auto 0">
        <q-btn
            round
            flat
            :style="user.role === UserRole.ADMIN ? 'border: 3px solid red' : ''"
        >
            <q-avatar
                v-if="!!user['avatarUrl'] && user['avatarUrl'] !== ''"
                size="32px"
            >
                <img
                    :src="user['avatarUrl']"
                    referrerpolicy="no-referrer"
                    alt="avatar"
                >
            </q-avatar>

            <q-avatar v-else size="36px">
                <q-icon name="sym_o_account_circle" />
            </q-avatar>

            <q-menu auto-close style="width: 280px; padding: 8px">
                <q-list style="gap: 4px; display: flex; flex-direction: column">
                    <q-item
                        v-close-popup
                        clickable
                        @click="
                            // @ts-ignore
                            // eslint-disable-next-line vue/v-on-handler-style
                            () => {
                                navigate();
                            }
                        "
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

                    <q-item clickable class="text-error" @click="logout">
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
import { useUser } from 'src/hooks/customQueryHooks';
import { UserRole } from '@common/enum';

const $router = useRouter();

const navigateTo = async (path: string): Promise<void> => {
    await $router.push(path);
};

const { data: user } = useUser();

const navigate = (): void => {
    navigateTo(ROUTES.USER_PROFILE.path);
};
</script>

<style scoped>
.q-item__section--avatar {
    min-width: 0;
}
</style>
