// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import Redoc from '../components/Redoc.vue';

export default {
    ...DefaultTheme,
    enhanceApp({ app }) {
        // Register the Redoc component globally
        app.component('Redoc', Redoc);
    },
};
