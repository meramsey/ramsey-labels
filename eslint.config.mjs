import globals from 'globals';
export default [
    { ignores: ['vendor/**', 'node_modules/**', 'build/**', 'test-results/**'] },
    {
        files: ['assets/**/*.js', 'tests/**/*.cjs', 'bin/*.cjs'],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
            sourceType: 'commonjs',
        },
        rules: {
            'no-undef': 'error',
            'no-unreachable': 'error',
            'no-dupe-keys': 'error',
            'no-constant-condition': ['error', { checkLoops: false }],
        },
    },
];
