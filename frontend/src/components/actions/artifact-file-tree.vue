<template>
    <div
        class="bg-grey-2 rounded-borders q-pa-sm"
        style="max-height: 200px; overflow-y: auto"
    >
        <q-tree
            :nodes="artifactFileTree"
            node-key="label"
            dense
            class="text-caption text-grey-8"
            style="font-family: monospace"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ files: string[] }>();

interface FileNode {
    label: string;
    icon?: string;
    children?: FileNode[];
}

const buildFileTree = (paths: string[]): FileNode[] => {
    const root: FileNode[] = [];

    for (const path of paths) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length === 0) continue;

        let currentLevel = root;

        for (const [index, part] of parts.entries()) {
            const isFile = index === parts.length - 1;
            let existingNode = currentLevel.find((node) => node.label === part);

            if (existingNode) {
                if (!isFile && !existingNode.children) {
                    existingNode.children = [];
                    delete existingNode.icon;
                }
            } else {
                existingNode = {
                    label: part,
                    ...(isFile
                        ? { icon: 'sym_o_insert_drive_file' }
                        : { children: [] }),
                };
                currentLevel.push(existingNode);
            }

            if (!isFile) {
                if (!existingNode.children) {
                    existingNode.children = [];
                }
                currentLevel = existingNode.children;
            }
        }
    }

    return root;
};

const artifactFileTree = computed(() => {
    if (!props.files) return [];
    return buildFileTree(props.files);
});
</script>
