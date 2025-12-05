/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]sx?$': [
            'ts-jest',
            {
                tsconfig: {
                    allowJs: true,
                },
            },
        ],
    },
    moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/../common/$1',
        '^@kleinkram/backend-common$':
            '<rootDir>/../packages/backend-common/dist/index.js',
        '^@kleinkram/backend-common/(.*)$':
            '<rootDir>/../packages/backend-common/dist/$1',
        '^@backend-common/(.*)$':
            '<rootDir>/../packages/backend-common/dist/$1',
        '^@kleinkram/shared$': '<rootDir>/../packages/shared/dist/index.js',
        '^@kleinkram/shared/(.*)$': '<rootDir>/../packages/shared/dist/$1',
        '^@kleinkram/validation$':
            '<rootDir>/../packages/validation/dist/index.js',
        '^@kleinkram/validation/(.*)$':
            '<rootDir>/../packages/validation/dist/$1',
        '^@kleinkram/api-dto$': '<rootDir>/../packages/api-dto/dist/index.js',
        '^@kleinkram/api-dto/(.*)$': '<rootDir>/../packages/api-dto/dist/$1',
    },
    preset: 'ts-jest',
    modulePathIgnorePatterns: ['<rootDir>/dist/'],
    transformIgnorePatterns: [],
    reporters: ['<rootDir>/tests/utils/reporter.js'],
};

// set env variables from ../.env
require('dotenv').config({ path: '../.env' });
