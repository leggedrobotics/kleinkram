<template>
    <div class="sessions">
        <div class="sessions__intro">
            <p>
                Where you are signed in: this browser, other browsers and the
                Kleinkram CLI (<code>klein login</code>). Signing out a session
                ends it at once, also on a lost laptop or robot.
            </p>
            <q-btn
                flat
                outline
                no-caps
                class="button-border"
                label="Sign out all other sessions"
                :disable="otherSessions.length === 0"
                :loading="isRevokingOthers"
                @click="confirmRevokeOthers"
            />
        </div>

        <q-table
            flat
            :bordered="!$q.screen.xs"
            :grid="$q.screen.xs"
            :rows="sessions"
            :columns="columns"
            row-key="uuid"
            :loading="isLoading"
            hide-pagination
            :rows-per-page-options="[0]"
            separator="horizontal"
            no-data-label="No active sessions"
        >
            <template #body-cell-device="props">
                <q-td :props="props">
                    <div class="sessions__device">
                        <q-icon
                            :name="
                                props.row.kind === SessionKind.CLI
                                    ? 'sym_o_terminal'
                                    : 'sym_o_language'
                            "
                            size="20px"
                        />
                        <div>
                            <div>
                                {{ deviceName(props.row) }}
                                <span
                                    v-if="props.row.current"
                                    class="sessions__current"
                                >
                                    This session
                                </span>
                            </div>
                            <div class="sessions__secondary">
                                {{ deviceDetails(props.row) }}
                            </div>
                        </div>
                    </div>
                </q-td>
            </template>

            <template #body-cell-actions="props">
                <q-td :props="props">
                    <q-btn
                        flat
                        dense
                        no-caps
                        color="link-primary"
                        label="Sign out"
                        :loading="revoking === props.row.uuid"
                        @click="() => signOut(props.row)"
                    />
                </q-td>
            </template>

            <template #item="props">
                <div class="col-12 q-pb-sm">
                    <q-card flat bordered>
                        <q-card-section class="sessions__card">
                            <div class="sessions__device">
                                <q-icon
                                    :name="
                                        props.row.kind === SessionKind.CLI
                                            ? 'sym_o_terminal'
                                            : 'sym_o_language'
                                    "
                                    size="20px"
                                />
                                <div>
                                    <div>
                                        {{ deviceName(props.row) }}
                                        <span
                                            v-if="props.row.current"
                                            class="sessions__current"
                                        >
                                            This session
                                        </span>
                                    </div>
                                    <div class="sessions__secondary">
                                        {{ deviceDetails(props.row) }}
                                    </div>
                                    <div class="sessions__secondary">
                                        Last active
                                        {{ formatDate(props.row.lastUsedAt) }}
                                    </div>
                                </div>
                            </div>
                            <q-btn
                                flat
                                dense
                                no-caps
                                color="link-primary"
                                label="Sign out"
                                :loading="revoking === props.row.uuid"
                                @click="() => signOut(props.row)"
                            />
                        </q-card-section>
                    </q-card>
                </div>
            </template>
        </q-table>
    </div>
</template>

<script setup lang="ts">
import type { SessionDto } from '@kleinkram/api-dto/types/user/session.dto';
import { SessionKind } from '@kleinkram/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { QTableColumn } from 'quasar';
import { Notify, useQuasar } from 'quasar';
import { logout } from 'src/services/auth';
import { formatDate } from 'src/services/date-formating';
import {
    getMySessions,
    revokeMyOtherSessions,
    revokeMySession,
} from 'src/services/queries/user';
import { computed, ref } from 'vue';

const $q = useQuasar();
const queryClient = useQueryClient();

const { data, isLoading } = useQuery({
    queryKey: ['my-sessions'],
    queryFn: getMySessions,
});

const sessions = computed(() => data.value?.sessions ?? []);
const otherSessions = computed(() =>
    sessions.value.filter((session) => !session.current),
);

const deviceName = (session: SessionDto): string =>
    session.name ??
    (session.kind === SessionKind.CLI ? 'Kleinkram CLI' : 'Browser');

const deviceDetails = (session: SessionDto): string =>
    [
        session.kind === SessionKind.CLI ? 'CLI' : 'Web',
        session.platform,
        session.clientVersion ? `version ${session.clientVersion}` : undefined,
    ]
        .filter((part) => part !== undefined && part !== '')
        .join(' · ');

const columns: QTableColumn<SessionDto>[] = [
    { name: 'device', label: 'Device', field: 'name', align: 'left' },
    {
        name: 'createdAt',
        label: 'Signed in',
        field: 'createdAt',
        align: 'left',
        format: (value: Date) => formatDate(new Date(value)),
    },
    {
        name: 'lastUsedAt',
        label: 'Last active',
        field: 'lastUsedAt',
        align: 'left',
        format: (value: Date) => formatDate(new Date(value)),
    },
    {
        name: 'expiresAt',
        label: 'Ends if unused',
        field: 'expiresAt',
        align: 'left',
        format: (value: Date) => formatDate(new Date(value)),
    },
    { name: 'actions', label: '', field: 'uuid', align: 'right' },
];

const notifyError = (error: unknown): void => {
    Notify.create({
        message:
            error instanceof Error
                ? `Could not sign out: ${error.message}`
                : 'Could not sign out',
        color: 'negative',
        position: 'bottom',
    });
};

const revoking = ref<string | undefined>(undefined);

const signOut = async (session: SessionDto): Promise<void> => {
    // signing out this session is a normal logout
    if (session.current) {
        await logout();
        return;
    }
    revoking.value = session.uuid;
    try {
        await revokeMySession(session.uuid);
        Notify.create({
            message: `Signed out ${deviceName(session)}`,
            color: 'positive',
            position: 'bottom',
        });
    } catch (error) {
        notifyError(error);
    } finally {
        revoking.value = undefined;
        await queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
    }
};

const { mutate: revokeOthers, isPending: isRevokingOthers } = useMutation({
    mutationFn: revokeMyOtherSessions,
    onSuccess: () => {
        Notify.create({
            message: 'Signed out all other sessions',
            color: 'positive',
            position: 'bottom',
        });
    },
    onError: notifyError,
    onSettled: () =>
        queryClient.invalidateQueries({ queryKey: ['my-sessions'] }),
});

const confirmRevokeOthers = (): void => {
    $q.dialog({
        title: 'Sign out all other sessions?',
        message: `This ends ${String(otherSessions.value.length)} other session(s), including CLI logins. They need to log in again.`,
        cancel: { flat: true, noCaps: true, label: 'Cancel', color: 'grey-8' },
        ok: {
            flat: true,
            noCaps: true,
            label: 'Sign out',
            class: 'bg-button-primary',
        },
    }).onOk(() => {
        revokeOthers();
    });
};
</script>

<style scoped>
.sessions {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.sessions__intro {
    align-items: flex-start;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: space-between;
}

.sessions__intro p {
    color: #525252;
    margin: 0;
    max-width: 640px;
}

.sessions__intro code {
    background: #f4f4f4;
    font-size: 12px;
    padding: 1px 4px;
}

.sessions__device {
    align-items: flex-start;
    display: flex;
    gap: 12px;
}

.sessions__secondary {
    color: #6f6f6f;
    font-size: 12px;
}

.sessions__current {
    background: #e0e0e0;
    color: #161616;
    font-size: 12px;
    margin-left: 8px;
    padding: 1px 8px;
}

.sessions__card {
    align-items: flex-start;
    display: flex;
    justify-content: space-between;
}
</style>
