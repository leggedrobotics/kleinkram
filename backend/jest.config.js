/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]sx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.test.json',
            },
        ],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@common/(.*)$': '<rootDir>/../common/$1',
        '^@kleinkram/backend-common$':
            '<rootDir>/../packages/backend-common/src/index.ts',
        '^@kleinkram/backend-common/(.*)$':
            '<rootDir>/../packages/backend-common/src/$1',
        '^@backend-common/(.*)$': '<rootDir>/../packages/backend-common/src/$1',
        '^@kleinkram/shared$': '<rootDir>/../packages/shared/src/index.ts',
        '^@kleinkram/shared/(.*)$': '<rootDir>/../packages/shared/src/$1',
        '^@kleinkram/validation$':
            '<rootDir>/../packages/validation/src/index.ts',
        '^@kleinkram/validation/(.*)$':
            '<rootDir>/../packages/validation/src/$1',
        '^@kleinkram/api-dto$': '<rootDir>/../packages/api-dto/src/index.ts',
        '^@kleinkram/api-dto/(.*)$': '<rootDir>/../packages/api-dto/src/$1',
    },
    preset: 'ts-jest',
    modulePathIgnorePatterns: ['<rootDir>/dist/'],
    transformIgnorePatterns: [],
    reporters: ['<rootDir>/tests/utils/reporter.js'],
};

// set env variables from ../.env
require('dotenv').config({ path: '../.env' });
