// src/boot/vue-query.js
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: true,
            staleTime: 1000 * 60,
        },
    },
});

const query = ({ app }: any): void => {
    app.use(VueQueryPlugin, { queryClient });
};
export default query;
