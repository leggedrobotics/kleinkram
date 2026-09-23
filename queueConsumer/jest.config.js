/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/**/*.test.ts'],
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@kleinkram/shared$': '<rootDir>/../packages/shared/src/index.ts',
        '^@kleinkram/shared/(.*)$': '<rootDir>/../packages/shared/src/$1',
    },
    modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
