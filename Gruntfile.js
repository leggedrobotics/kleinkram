const fs = require('fs-extra');
const ini = require('ini');

module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-bump');

    grunt.initConfig({
        bump: {
            options: {
                files: ['package.json', '*/package.json'],
                commit: false,
                push: false,
                createTag: false,
                taskList: ['python-bump'],
            },
        },
    });

    grunt.registerTask(
        'python-bump',
        'Bump the version in setup.cfg',
        function () {
            const opts = this.options({
                file: 'cli/setup.cfg',
            });

            const filePath = opts.file;

            // get version from package.json
            const packageJson = grunt.file.readJSON('package.json');
            const version = packageJson.version;

            if (!version) {
                grunt.fail.warn('No version specified for bump.');
                return;
            }

            if (!fs.existsSync(filePath)) {
                grunt.fail.warn(`File not found: ${filePath}`);
                return;
            }

            try {
                const data = fs.readFileSync(filePath, 'utf8');
                const parsed = ini.parse(data);

                if (parsed.metadata && parsed.metadata.version) {
                    parsed.metadata.version = version;

                    const output = ini.stringify(parsed);
                    fs.writeFileSync(filePath, output, 'utf8');
                    grunt.log.writeln(
                        `Version bumped to ${version} in ${filePath}`,
                    );
                } else {
                    grunt.fail.warn(
                        'No [metadata] section or version found in setup.cfg',
                    );
                }
            } catch (err) {
                grunt.fail.warn(`Error processing file: ${err.message}`);
            }
        },
    );

    // Register a new composite task that runs 'bump' and then 'pyproject'
    grunt.registerTask('bumpVersion', function (target) {
        if (!target) {
            target = 'patch'; // default to 'patch' if no target is specified
        }
        grunt.task.run(`bump:${target}`);
        grunt.task.run('python-bump');
    });

    grunt.registerTask('validateVersions', function () {
        // check if all versions are the same
        const packageJson = grunt.file.readJSON('package.json');
        const version = packageJson.version;
        console.log(`Checking all versions match ${version}`);

        const files = grunt.file.expand('*/package.json');
        files.push('package.json');

        files.forEach((file) => {
            const data = grunt.file.readJSON(file);
            if (data.version !== version) {
                grunt.fail.warn(
                    `Version mismatch: ${file} has version ${data.version} instead of ${version}`,
                );
            } else {
                console.log(`Version in ${file} matches ${version}`);
            }
        });

        // check if pyproject.toml has the same version
        const filePath = 'cli/setup.cfg';
        if (!fs.existsSync(filePath)) {
            grunt.fail.warn(`File not found: ${filePath}`);
            return;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = ini.parse(data);

        if (parsed.metadata && parsed.metadata.version) {
            if (parsed.metadata.version !== version) {
                grunt.fail.warn(
                    `Version mismatch: ${filePath} has version ${parsed.metadata.version} instead of ${version}`,
                );
            } else {
                console.log(`Version in ${filePath} matches ${version}`);
            }
        } else {
            grunt.fail.warn(
                'No [project] section or version found in pyproject.toml',
            );
        }
    });
};
