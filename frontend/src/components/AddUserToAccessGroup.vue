<template>
    <div style="margin: 10px" class="row flex items-center justify-between">
        <q-select
            v-model="selected"
            @input-value="
                (val) => {
                    search = val;
                    if (val.length > 0) {
                        $refs.userSelect.showPopup(); // Ensure dropdown opens again
                    }
                }
            "
            use-input
            multiple
            input-debounce="100"
            :options="foundUsers"
            option-label="name"
            ref="userSelect"
            class="full-width"
        >
            <template v-slot:no-option>
                <q-item>
                    <q-item-section class="text-grey">
                        No results
                    </q-item-section>
                </q-item>
            </template>
            <template v-slot:selected-item="scope">
                <q-chip
                    removable
                    @remove="scope.removeAtIndex(scope.index)"
                    :tabindex="scope.tabindex"
                    :icon="icon(scope.opt.type)"
                >
                    {{ scope.opt.name }}
                </q-chip>
            </template>
            <template v-slot:option="{ itemProps, opt }">
                <q-item v-bind="itemProps">
                    <q-item-section>
                        <q-item-label>
                            <div class="row" style="height: 20px">
                                <p
                                    style="
                                        width: 30%;
                                        min-width: 60px;
                                        max-width: 300px;
                                    "
                                >
                                    {{ opt.name }}
                                </p>
                                <p>{{ opt.email }}</p>
                            </div>
                        </q-item-label>
                    </q-item-section>
                </q-item>
            </template>
        </q-select>
    </div>
</template>
<script setup lang="ts">
import { Ref, ref } from 'vue';
import { icon } from 'src/services/generic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { searchUsers } from 'src/services/queries/user';
import { addUserToAccessGroup } from 'src/services/mutations/access';
import { User } from 'src/types/User';
import { Notify } from 'quasar';
import { canAddAccessGroup } from 'src/services/queries/access';
const props = defineProps<{
    access_group: string;
}>();
const queryClient = useQueryClient();

const search = ref('');
const selected: Ref<User[]> = ref([]);
const { data: foundUsers } = useQuery({
    queryKey: ['users', search],
    queryFn: () => searchUsers(search.value),
});

const { mutate } = useMutation({
    mutationFn: () => {
        return Promise.all(
            selected.value.map(async (user) => {
                return addUserToAccessGroup(user.uuid, props.access_group);
            }),
        );
    },
    onSuccess: () => {
        Notify.create({
            message: 'Users added to access group',
            color: 'positive',
            position: 'bottom',
        });
        queryClient.invalidateQueries({
            queryKey: ['AccessGroup', props.access_group],
        });
    },
    onError: () => {
        Notify.create({
            message: 'Failed to add some users to access group',
            color: 'negative',
            position: 'bottom',
        });
    },
});

defineExpose({ mutate });
</script>

<style scoped></style>
