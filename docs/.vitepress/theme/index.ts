// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import Module from '../components/module.vue';
import Create from '../components/AccessWrites/create.vue';
import CanEdit from '../components/AccessWrites/can-edit.vue';
import Modify from '../components/AccessWrites/modify.vue';
import Delete from '../components/AccessWrites/delete.vue';
import Any from '../components/AccessWrites/any.vue';
import Read from '../components/AccessWrites/read.vue';
import Creator from '../components/AccessWrites/creator.vue';
import ApiModulesTable from './components/api-modules-table.vue';
import { EnhanceAppContext } from 'vitepress';
import './custom.css'

export default {
    enhanceApp({ app }: EnhanceAppContext): void {
        // Register the Redoc component globally
        app.component('Module', Module);
        app.component('Create', Create);
        app.component('Read', Read);
        app.component('Modify', Modify);
        app.component('Delete', Delete);
        app.component('Any', Any);
        app.component('Creator', Creator);
        app.component('CanEdit', CanEdit);
        app.component('ApiModulesTable', ApiModulesTable);
    },
    extends: DefaultTheme,
};
