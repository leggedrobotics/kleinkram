// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import Module from '../components/Module.vue';
import Create from '../components/AccessWrites/Create.vue';
import Modify from '../components/AccessWrites/Modify.vue';
import Delete from '../components/AccessWrites/Delete.vue';
import Any from '../components/AccessWrites/Any.vue';
import Read from '../components/AccessWrites/Read.vue';
import Creator from '../components/AccessWrites/Creator.vue';

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        // Register the Redoc component globally
        app.component('Module', Module);
        app.component('Create', Create);
        app.component('Read', Read);
        app.component('Modify', Modify);
        app.component('Delete', Delete);
        app.component('Any', Any);
        app.component('Creator', Creator);
    },
};
