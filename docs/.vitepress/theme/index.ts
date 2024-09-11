// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import Module from '../components/Module.vue';

export default {
    ...DefaultTheme,
    enhanceApp({ app }) {
        // Register the Redoc component globally
        app.component('Module', Module);
    },
};
