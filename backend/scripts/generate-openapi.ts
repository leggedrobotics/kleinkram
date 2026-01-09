import { INestApplication, Type } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import * as fs from 'node:fs';
import path from 'node:path';
import 'reflect-metadata';

// Reuse constants from @nestjs/common if possible, or string literals
// PATH_METADATA 'path'
const PATH_METADATA = 'path';

function findControllers(directory: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const filePath = path.join(directory, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            findControllers(filePath, fileList);
        } else {
            if (file.endsWith('.controller.ts')) {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
}

async function generateOpenApi() {
    const outputDirectory =
        process.argv[2] && !process.argv[2].startsWith('-')
            ? path.resolve(process.argv[2])
            : process.cwd();

    if (process.argv[2]) {
        console.warn(`Writing output to: ${outputDirectory}`);
        if (!fs.existsSync(outputDirectory)) {
            fs.mkdirSync(outputDirectory, { recursive: true });
        }
    }

    console.warn('Scanning for controllers...');

    const controllersDirectory = path.join(__dirname, '../src/endpoints');
    const controllerFiles = findControllers(controllersDirectory);
    const controllers: Type[] = [];

    for (const file of controllerFiles) {
        // Dynamic import
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const module = await import(file);

        // Find exported classes that look like controllers
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        for (const exported of Object.values(module)) {
            if (typeof exported === 'function') {
                // Check if it has @Controller decorator metadata

                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const isController = Reflect.getMetadata(
                    PATH_METADATA,

                    exported,
                );
                if (isController !== undefined) {
                    console.warn(
                        `Found controller: ${(exported as Type).name}`,
                    );

                    controllers.push(exported as Type);
                }
            }
        }
    }

    if (controllers.length === 0) {
        console.warn('No controllers found! Swagger will be empty.');
    }

    console.warn(
        `Initializing NestJS TestingModule with ${String(controllers.length)} controllers...`,
    );

    const moduleFixture = await Test.createTestingModule({
        controllers,
        providers: [],
    })

        .useMocker((_token) => {
            // Create a recursive mock that handles any property access or method call
            const recursiveMock = new Proxy(
                {},
                {
                    get: (target, property) => {
                        if (
                            property === 'then' ||
                            property === 'catch' ||
                            property === 'finally'
                        ) {
                            return; // Not a promise
                        }
                        if (property === 'toJSON') {
                            return () => ({});
                        }

                        // Return a function that returns the recursive mock (for method chaining)
                        // If properties are accessed (not called), it returns the function which is truthy/object-ish

                        // eslint-disable-next-line unicorn/consistent-function-scoping
                        return (..._args: unknown[]) => recursiveMock;
                    },
                },
            );
            return recursiveMock;
        })
        .compile();

    const app = moduleFixture.createNestApplication();

    const config = new DocumentBuilder()
        .setTitle('API Documentation')
        .setDescription('API description')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);

    fs.writeFileSync(
        path.join(outputDirectory, 'swagger.json'),
        JSON.stringify(document, null, 2),
    );
    // eslint-disable-next-line no-console
    console.log('swagger.json generated successfully.');

    // Initialize the app to generate the router stack
    await app.init();
    saveEndpointsAsJson(
        app,
        path.join(outputDirectory, '__generated__endpoints.json'),
    );

    // Generate api-modules.md
    console.warn('Generating api-modules.md...');
    let mdContent = '| Module | Path | Description |\n| :--- | :--- | :--- |\n';

    // Also generate a JSON file for the Vue component
    const modules: {
        name: string;
        path: string;
        link: string;
        description: string;
    }[] = [];

    // Sort controllers by path for better readability
    // eslint-disable-next-line unicorn/no-array-sort
    const sortedControllers = controllers.sort((a, b) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        let pathA = Reflect.getMetadata(PATH_METADATA, a);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        let pathB = Reflect.getMetadata(PATH_METADATA, b);

        // Handle array of paths (take first) or undefined
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        if (Array.isArray(pathA)) pathA = pathA[0];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        if (Array.isArray(pathB)) pathB = pathB[0];

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        pathA = String(pathA || '');
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        pathB = String(pathB || '');

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return pathA.localeCompare(pathB);
    });

    for (const controller of sortedControllers) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        let controllerPath = Reflect.getMetadata(PATH_METADATA, controller);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        if (Array.isArray(controllerPath)) controllerPath = controllerPath[0];
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        controllerPath = String(controllerPath || '');
        // Try to infer a nice name/link.
        // We don't have the file path easily associated with the class here unless we kept it.
        // But we can guess from the class name: AccessController -> access
        const name = controller.name.replace('Controller', '').toLowerCase();

        // Generate component file for this module
        const moduleFileName = `${name}.md`;
        const moduleTitle = name.charAt(0).toUpperCase() + name.slice(1);
        const moduleContent = `---
aside: false
---

# ${moduleTitle} Module

// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
<Module module="${String(controllerPath)}"></Module>
`;
        fs.writeFileSync(
            path.join(outputDirectory, moduleFileName),
            moduleContent,
        );

        // Check if we can link to a file. We assume the doc file exists and is named {name}.md
        // We can't easily check file existence in docs/ from here without path traversing,
        // but broadly we can assume standard naming convention.
        const link = `[\`${name}\`](${name}.md)`;

        mdContent += `| ${link} | \`/${String(controllerPath)}\` | Docs for ${name} module |\n`;

        modules.push({
            name: name,
            path: `/${String(controllerPath)}`,
            link: `generated/${name}`,
            description: `Docs for ${name} module`,
        });
    }

    fs.writeFileSync(path.join(outputDirectory, 'api-modules.md'), mdContent);
    fs.writeFileSync(
        path.join(outputDirectory, 'api-modules.json'),
        JSON.stringify(modules, null, 2),
    );
    console.warn(
        'api-modules.md, api-modules.json and individual module files generated successfully.',
    );

    await app.close();
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
}

interface ExpressLayer {
    route?: {
        path: string;
        stack: { method: string }[];
    };
}

interface ExpressRouter {
    stack: ExpressLayer[];
}

interface HttpServerWithRouter {
    _events?: {
        request?: {
            _router?: ExpressRouter;
        };
    };
}

function saveEndpointsAsJson(app: INestApplication, filename: string): void {
    const server = app.getHttpServer() as HttpServerWithRouter;

    const router = server._events?.request?._router;

    if (!router) {
        return;
    }

    const endpoints = router.stack
        .filter((r) => r.route)
        .map((r) => ({
            url: r.route?.path,
            method: r.route?.stack[0]?.method,
        }));

    try {
        fs.writeFileSync(filename, JSON.stringify(endpoints, null, 2));
        console.warn(`Endpoints saved to ${filename}`);
    } catch (error) {
        console.warn(
            `Failed to save endpoints to ${filename}: ${String(error)}`,
        );
    }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
generateOpenApi().catch((error: unknown) => {
    console.error(error);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
});
