export default {

    lang: 'en-US',

    title: 'Bagestry',
    description: 'A structured bag and mcap dataset storage.',
    titleTemplate: ':title - Custom Suffix',

    themeConfig: {

        nav: [
            {
                text: 'For Users', link: '/usage/getting-started',
            },
            {
                text: 'For Developers', link: '/development/getting-started',
            },
        ],

        sidebar: {
            '/usage/': [
                {
                    text: 'Introduction',
                    items: [
                        {
                            text: 'Getting Started', link: '/usage/getting-started',
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
                            text: 'Getting Started', link: '/development/getting-started',
                        },
                        {
                            text: 'Application Structure', link: '/development/application-structure',
                        },
                    ],
                    collapsed: false,
                },
            ],

        },

        editLink: {
            pattern: 'https://github.com/leggedrobotics/GrandTourDatasets/edit/master/docs/:path',
            text: 'Edit this page on GitHub',
        },

        socialLinks: [
            {
                icon: 'github', link: 'https://github.com/leggedrobotics/GrandTourDatasets',
            },
        ],

        search: {
            provider: 'local',
        },

        footer: {
            message: 'Released under the ??? License.',
            copyright: 'Copyright © 2024-present Robotics Systems Lab'
        }

    },

};