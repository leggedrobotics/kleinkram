export default {
    lang: 'en-US',

    title: 'Bagestry',
    description: 'A structured bag and mcap dataset storage.',
    titleTemplate: ':title - Custom Suffix',

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
};
