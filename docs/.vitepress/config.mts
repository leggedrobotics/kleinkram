import {withMermaid} from 'vitepress-plugin-mermaid';

export default withMermaid({
    lang: 'en-US',

    title: 'Kleinkram',
    description: 'A structured bag and mcap dataset storage.',
    titleTemplate: ':title - Custom Suffix',


    mermaidPlugin: {
        class: "mermaid",
    },

    ignoreDeadLinks: true,
    themeConfig: {
        nav: [
            {
                text: 'For Users',
                link: '/usage/getting-started',
            },
            {
                text: 'For Developers',
                link: '/development/getting-started',
            },
        ],

        sidebar: {
            '/usage/': [
                {
                    text: 'Introduction',
                    items: [
                        {
                            text: 'Getting Started',
                            link: '/usage/getting-started',
                        },
                    ],
                    collapsed: false,
                },

                {
                    text: 'Kleinkram Actions',
                    items: [
                        {
                            text: 'Getting Started',
                            link: '/usage/actions/getting-started',
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
                        }
                    ],

                },

                {
                    text: 'CLI and API',
                    items: [
                        {
                            text: 'Getting Started',
                            link: '/usage/cli-api/cli-getting-started',
                        },
                    ],
                    collapsed: true,
                },

            ],
            '/development/': [
                {
                    text: 'Introduction',
                    items: [
                        {
                            text: 'Getting Started',
                            link: '/development/getting-started',
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
                    ],
                    collapsed: true,
                },
                {
                    text: 'API',
                    items: [
                        {
                            text: 'Introduction',
                            link: '/development/API/Introduction',
                        }
                    ]
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
                            link: '/development/testing/getting-started',
                        }
                    ]
                }

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
            message: 'Released under the ??? License.',
            copyright: 'Copyright © 2024-present Robotics Systems Lab',
        },
    },
});
