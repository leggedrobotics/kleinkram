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

export default {
    enhanceApp({ app }) {
        // Register the Redoc component globally

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        app.component('Module', Module);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        app.component('Create', Create);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        app.component('Read', Read);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        app.component('Modify', Modify);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        app.component('Delete', Delete);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        app.component('Any', Any);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        app.component('Creator', Creator);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        app.component('CanEdit', CanEdit);
    },
    extends: DefaultTheme,
};
