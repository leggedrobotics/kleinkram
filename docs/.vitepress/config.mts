import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid({
    lang: 'en-US',

    title: 'Kleinkram',
    description: 'A structured bag and mcap dataset storage.',
    titleTemplate: ':title - Custom Suffix',


    mermaidPlugin: {
        class: 'mermaid',
    },
    head: [
        [
            'link',
            { rel: 'stylesheet', href: 'https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined' },
        ],
    ],
    ignoreDeadLinks: true,
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
                    text: 'Introduction',
                    items: [
                        {
                            text: 'Getting Started',
                            link: '/usage/getting-started.md',
                        },
                    ],
                    collapsed: false,
                },

                {
                    text: 'Kleinkram Actions',
                    items: [
                        {
                            text: 'Getting Started',
                            link: '/usage/actions/getting-started.md',
                        },
                        {
                            text: 'Write Custom Actions',
                            link: '/usage/actions/write-custom-actions.md',
                        },
                    ],
                    collapsed: true,
                },
                {
                    text: 'Access Control',
                    collapsed: true,
                    items: [
                        {
                            text: 'Concepts',
                            link: '/usage/access-control/base-concepts',

                        },
                        {
                            text: 'Project',
                            link: '/usage/access-control/project',
                        },
                        {
                            text: 'Mission',
                            link: '/usage/access-control/mission',
                        },
                        {
                            text: 'File',
                            link: '/usage/access-control/file',
                        },
                        {
                            text: 'Action',
                            link: '/usage/access-control/action',
                        },
                        {
                            text: 'Access Group',
                            link: '/usage/access-control/access-group',
                        },
                        {
                            text: 'Example',
                            link: '/usage/access-control/example',
                        },
                    ],

                },

                {
                    text: 'Kleinkram CLI & Python Package',
                    items: [
                        {
                            text: 'Getting Started',
                            link: '/usage/python/getting-started.md',
                        },
                    ],
                    collapsed: true,
                },
                {
                    text: 'Files',
                    items: [
                        {
                            text: 'Getting Started',
                            link: '/usage/files/files',
                        },
                    ],
                },

            ],
            '/development/': [
                {
                    text: 'Introduction',
                    items: [
                        {
                            text: 'Getting Started',
                            link: '/development/getting-started.md',
                        },
                    ],
                    collapsed: true,
                },
                {
                    text: 'Application Structure',
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
                            text: 'Databases and File Storage',
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
                            text: 'Logging and Monitoring',
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
                            text: 'Documentation',
                            link: '/development/application-structure/docs',
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
                            items: [
                                {
                                    text: 'Access Filtering',
                                    link: '/development/access-control/addAccessConstraints',
                                },
                            ],
                        },
                    ],
                    collapsed: true,
                },
                {
                    text: 'API, CLI & Python Package',
                    items: [
                        {
                            text: 'Developing the API',
                            link: '/development/api/Introduction',
                        },
                        {
                            text: 'Developing the CLI and Python Package',
                            link: '/development/python/getting-started.md',
                        },
                    ],
                },
                {
                    text: 'Migrations',
                    items: [
                        {
                            text: 'Running Migrations',
                            link: '/development/migrations/Readme',
                        },
                    ],
                },
                {
                    text: 'Testing',
                    items: [

                        {
                            text: 'Run Testsuite',
                            link: '/development/testing/getting-started.md',
                        },
                    ],
                },
                {
                    text: 'Cronjobs',
                    link: '/development/cron/CronJobs',
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
            message: 'Released under the MIT License.<br /><a href="https://datasets.leggedrobotics.com/">datasets.leggedrobotics.com</a>',
            copyright: 'Copyright © 2024-present Robotic Systems Lab',
        },
    },
});
