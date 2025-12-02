<template>
    <div class="anymal-state-viewer">
        <ViewerLayout
            :messages="messages"
            :total-count="totalCount"
            :is-loading="isLoading"
        >
            <div v-if="latestMessage" class="row q-col-gutter-md">
                <!-- State & Frame -->
                <div class="col-12 row q-col-gutter-md">
                    <div class="col-6">
                        <div class="text-caption text-grey-7">State</div>
                        <div class="text-h6">{{ latestMessage.state }}</div>
                    </div>
                    <div class="col-6">
                        <div class="text-caption text-grey-7">Frame ID</div>
                        <div>
                            <q-badge color="grey-3" text-color="black">
                                {{ latestMessage.header.frame_id }}
                            </q-badge>
                        </div>
                    </div>
                </div>

                <q-separator class="col-12 q-my-sm" />

                <!-- Pose -->
                <div class="col-12">
                    <div class="text-subtitle2 q-mb-xs text-primary">Pose</div>
                    <div class="row q-col-gutter-sm">
                        <div class="col-12 col-sm-6">
                            <div class="text-caption text-grey-7">Position</div>
                            <div class="text-body2">
                                X:
                                {{
                                    latestMessage.pose.pose.position.x.toFixed(
                                        4,
                                    )
                                }}<br />
                                Y:
                                {{
                                    latestMessage.pose.pose.position.y.toFixed(
                                        4,
                                    )
                                }}<br />
                                Z:
                                {{
                                    latestMessage.pose.pose.position.z.toFixed(
                                        4,
                                    )
                                }}
                            </div>
                        </div>
                        <div class="col-12 col-sm-6">
                            <div class="text-caption text-grey-7">
                                Orientation
                            </div>
                            <div class="text-body2">
                                X:
                                {{
                                    latestMessage.pose.pose.orientation.x.toFixed(
                                        4,
                                    )
                                }}<br />
                                Y:
                                {{
                                    latestMessage.pose.pose.orientation.y.toFixed(
                                        4,
                                    )
                                }}<br />
                                Z:
                                {{
                                    latestMessage.pose.pose.orientation.z.toFixed(
                                        4,
                                    )
                                }}<br />
                                W:
                                {{
                                    latestMessage.pose.pose.orientation.w.toFixed(
                                        4,
                                    )
                                }}
                            </div>
                        </div>
                    </div>
                </div>

                <q-separator class="col-12 q-my-sm" />

                <!-- Twist -->
                <div class="col-12">
                    <div class="text-subtitle2 q-mb-xs text-primary">Twist</div>
                    <div class="row q-col-gutter-sm">
                        <div class="col-12 col-sm-6">
                            <div class="text-caption text-grey-7">Linear</div>
                            <div class="text-body2">
                                X:
                                {{
                                    latestMessage.twist.twist.linear.x.toFixed(
                                        4,
                                    )
                                }}<br />
                                Y:
                                {{
                                    latestMessage.twist.twist.linear.y.toFixed(
                                        4,
                                    )
                                }}<br />
                                Z:
                                {{
                                    latestMessage.twist.twist.linear.z.toFixed(
                                        4,
                                    )
                                }}
                            </div>
                        </div>
                        <div class="col-12 col-sm-6">
                            <div class="text-caption text-grey-7">Angular</div>
                            <div class="text-body2">
                                X:
                                {{
                                    latestMessage.twist.twist.angular.x.toFixed(
                                        4,
                                    )
                                }}<br />
                                Y:
                                {{
                                    latestMessage.twist.twist.angular.y.toFixed(
                                        4,
                                    )
                                }}<br />
                                Z:
                                {{
                                    latestMessage.twist.twist.angular.z.toFixed(
                                        4,
                                    )
                                }}
                            </div>
                        </div>
                    </div>
                </div>

                <q-separator class="col-12 q-my-sm" />

                <!-- Summary -->
                <div class="col-12 row q-col-gutter-md">
                    <div class="col-6">
                        <div class="text-caption text-grey-7">Joints</div>
                        <div class="text-body1">
                            {{ latestMessage.joints?.name?.length || 0 }}
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="text-caption text-grey-7">Contacts</div>
                        <div class="text-body1">
                            {{ latestMessage.contacts?.length || 0 }}
                        </div>
                    </div>
                </div>
            </div>
        </ViewerLayout>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ViewerLayout from './common/viewer-layout.vue';

const properties = defineProps<{
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);

const latestMessage = computed(() => {
    if (properties.messages.length === 0) return null;
    return properties.messages.at(-1).data;
});
</script>

<style scoped>
/* No styles needed */
</style>
