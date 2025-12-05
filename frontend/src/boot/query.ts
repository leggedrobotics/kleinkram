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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const query = ({ app }: any): void => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    app.use(VueQueryPlugin, { queryClient });
};
export default query;
