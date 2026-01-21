import { withMermaid } from 'vitepress-plugin-mermaid';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export default withMermaid({
    lang: 'en-US',
    cleanUrls: true,

    title: 'Kleinkram',
    description: 'A structured bag and mcap dataset storage.',
    titleTemplate: ':title - Custom Suffix',


    mermaidPlugin: {
        class: 'mermaid',
    },
    vite: {
        envDir: '..',
        envPrefix: ['VITE_', 'BACKEND_URL'],
        // force use of esm version of dayjs
        resolve: {
            alias: {
                // legacy alias to force esm version of dayjs for main entry only
                // using exact match to allow plugins (which are files in root) to resolve correctly
                '^dayjs$': require.resolve('dayjs/esm/index.js'),
            },
        },
        optimizeDeps: {
            include: ['mermaid'],
        },
    },
    head: [
        [
            'link',
            { rel: 'stylesheet', href: 'https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined' },
        ],
    ],
    ignoreDeadLinks: false,
    themeConfig: {
        nav: [
            {
                text: 'For Users',
                link: '/usage/getting-started.md',
            },
            {
                text: 'For Developers',
                link: '/development/getting-started.md',
            },
        ],

        sidebar: {
            '/usage/': [
                {
                    text: 'Introduction for Users',
                    items: [
                        {
                            text: 'How to Use Kleinkram?',
                            link: '/usage/getting-started.md',
                        },
                        {
                            text: 'FAQ',
                            link: '/usage/faq.md',
                        },
                    ],
                    collapsed: false,
                },
                {
                    text: 'CLI & Python',
                    items: [
                        {
                            text: 'Setup & Installation',
                            link: '/usage/python/setup.md',
                        },
                        {
                            text: 'CLI Reference',
                            link: '/usage/python/cli.md',
                        },
                        {
                            text: 'Python SDK Reference',
                            link: '/usage/python/sdk.md',
                        },
                    ],
                    collapsed: false,
                },
                {
                    text: 'Data Organization',
                    items: [
                        {
                            text: 'File Formats',
                            link: '/usage/files/files',
                        },
                        {
                            text: 'Access Control',
                            link: '/usage/access-control/base-concepts',
                            items: [
                                { text: 'Project Level', link: '/usage/access-control/project' },
                                { text: 'Mission Level', link: '/usage/access-control/mission' },
                                { text: 'File Level', link: '/usage/access-control/file' },
                                { text: 'Action Level', link: '/usage/access-control/action' },
                                { text: 'Access Groups', link: '/usage/access-control/access-group' },
                            ],
                            collapsed: true,
                        },
                    ],
                    collapsed: false,
                },
                {
                    text: 'Actions & Automation',
                    items: [
                        {
                            text: 'Use Actions',
                            link: '/usage/actions/use-actions.md',
                        },
                        {
                            text: 'Action Triggers',
                            link: '/usage/actions/triggers.md',
                        },
                        {
                            text: 'Write Actions',
                            link: '/usage/actions/write-actions.md',
                        },
                        {
                            text: 'Example Actions',
                            link: '/usage/actions/examples.md',
                        }
                    ],
                    collapsed: false,
                },
            ],
            '/development/': [
                {
                    text: 'Introduction for Devs',
                    items: [
                        {
                            text: 'Try Kleinkram Locally',
                            link: '/development/try-locally.md',
                        },
                        {
                            text: 'How to Use Kleinkram?',
                            link: '/usage/getting-started.md',
                        },
                        {
                            text: 'Start Development',
                            link: '/development/getting-started.md',
                        },
                    ],
                    collapsed: false,
                },
                {
                    text: 'System Architecture',
                    items: [
                        {
                            text: 'Overview',
                            link: '/development/application-structure',
                        },
                        {
                            text: 'Core Services',
                            items: [
                                {
                                    text: 'frontend',
                                    link: '/development/application-structure/frontend',
                                },
                                {
                                    text: 'api-server',
                                    link: '/development/application-structure/api-server',
                                },
                                {
                                    text: 'queue-processor',
                                    link: '/development/application-structure/queue-processor',
                                },
                            ],
                            collapsed: true,
                        },
                        {
                            text: 'Databases & Storage',
                            items: [
                                {
                                    text: 'minio',
                                    link: '/development/application-structure/minio',
                                },
                                {
                                    text: 'postgres',
                                    link: '/development/application-structure/postgres',
                                },
                                {
                                    text: 'redis',
                                    link: '/development/application-structure/redis',
                                },
                                {
                                    text: 'prometheus',
                                    link: '/development/application-structure/prometheus',
                                },
                            ],
                            collapsed: true,
                        },
                        {
                            text: 'Logging & Monitoring',
                            items: [
                                {
                                    text: 'grafana',
                                    link: '/development/application-structure/grafana',
                                },
                                {
                                    text: 'tempo',
                                    link: '/development/application-structure/tempo',
                                },
                                {
                                    text: 'loki',
                                    link: '/development/application-structure/loki',
                                },
                            ],
                            collapsed: true,
                        },
                        {
                            text: 'Access Control',
                            items: [
                                {
                                    text: 'Base Concepts',
                                    link: '/development/access-control/base-concepts',
                                },
                                {
                                    text: 'Implementation',
                                    link: '/development/access-control/implementation',
                                },
                            ],
                            collapsed: true,
                        },
                    ],
                    collapsed: true,
                },
                {
                    text: 'Details',
                    items: [
                        {
                            text: 'API Development',
                            link: '/development/api/Introduction',
                        },
                        {
                            text: 'CLI & Python SDK',
                            link: '/development/python/getting-started.md',
                        },
                        {
                            text: 'Database Migrations',
                            link: '/development/migrations/migrations',
                        },
                        {
                            text: 'Testing',
                            link: '/development/testing/getting-started.md',
                        },
                        {
                            text: 'Cronjobs',
                            link: '/development/cron/CronJobs',
                        },
                        {
                            text: 'Environment Variables',
                            link: '/development/environment-variables.md',
                        },
                        {
                            text: 'GitHub Actions',
                            link: '/development/github-actions.md',
                        },
                    ],
                    collapsed: true,
                },

            ],
        },

        editLink: {
            pattern:
                'https://github.com/leggedrobotics/GrandTourDatasets/edit/master/docs/:path',
            text: 'Edit this page on GitHub',
        },

        socialLinks: [
            {
                icon: 'github',
                link: 'https://github.com/leggedrobotics/GrandTourDatasets',
            },
        ],

        search: {
            provider: 'local',
        },

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2026 - Robotic Systems Lab',
        },
    },
});
