<template>
    <div>
        <p>{{ title }}</p>
        <ul>
            <li v-for="todo in todos" :key="todo.id" @click="increment">
                {{ todo.id }} - {{ todo.content }}
            </li>
        </ul>
        <p>Count: {{ todoCount }} / {{ meta.totalCount }}</p>
        <p>Active: {{ active ? 'yes' : 'no' }}</p>
        <p>Clicks on todos: {{ clickCount }}</p>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface Properties {
    title: string;
    todos?: any[];
    meta: any;
    active: boolean;
}

const properties = withDefaults(defineProps<Properties>(), {
    todos: () => [],
});

const clickCount = ref(0);

function increment() {
    clickCount.value += 1;
    return clickCount.value;
}

const todoCount = computed(() => properties.todos.length);
</script>
