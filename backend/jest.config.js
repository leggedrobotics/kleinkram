/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+.tsx?$': ['ts-jest', {}],
    },
    moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/../common/$1',
    },
    preset: 'ts-jest',
    modulePathIgnorePatterns: ['<rootDir>/dist/'],
    reporters: ['<rootDir>/tests/utils/reporter.js'],
};

// set env variables from ../.env
require('dotenv').config({ path: '../.env' });
