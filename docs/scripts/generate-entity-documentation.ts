import fs from 'node:fs';
import path from 'node:path';
import { ClassDeclaration, Project, PropertyDeclaration } from 'ts-morph';

import { fileURLToPath } from 'node:url';

// Configuration
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(fs.realpathSync(__dirname), '..'); // Should be 'docs/' root
const ENTITIES_DIR = path.resolve(
    ROOT_DIR,
    '../packages/backend-common/src/entities',
);
// Adjust this path if your docs structure is different
const OUTPUT_FILE = path.resolve(
    ROOT_DIR,
    'development/application-structure/postgres.md',
);

// Initialize ts-morph project
const project = new Project();

// Add source files
project.addSourceFilesAtPaths(`${ENTITIES_DIR}/**/*.entity.ts`);

function getColumnType(property: PropertyDeclaration): string {
    const decorators = property.getDecorators();
    for (const dec of decorators) {
        if (dec.getName() === 'Column') {
            const args = dec.getArguments();
            if (args.length > 0) {
                // Try to extract type from options object e.g. @Column({ type: 'enum' })
                // This is a naive extraction for simplicity
                const text = args[0].getText();
                if (text.includes("type: 'enum'")) return 'enum';
                if (text.includes("type: 'int'")) return 'integer';
                if (text.includes("type: 'bigint'")) return 'bigint';
                if (text.includes("type: 'text'")) return 'text';
                if (text.includes("type: 'jsonb'")) return 'jsonb';
            }
        }
        if (dec.getName() === 'PrimaryGeneratedColumn') return 'uuid (PK)';
        if (dec.getName() === 'CreateDateColumn') return 'timestamp';
        if (dec.getName() === 'UpdateDateColumn') return 'timestamp';
    }

    // Fallback to TS type
    return property
        .getType()
        .getText()
        .replaceAll(/import\(.*?\)\./g, '');
}

function getConstraints(property: PropertyDeclaration): string {
    const decorators = property.getDecorators();
    const constraints: string[] = [];

    // Check for explicit nullable: true in decorators
    let isNullable = false;

    for (const dec of decorators) {
        if (dec.getName() === 'OneToMany') return 'OneToMany'; // Skip simple constraints for relations
        if (dec.getName() === 'ManyToMany') return 'ManyToMany';

        if (dec.getName() === 'ManyToOne') {
            constraints.push('FK');
        }

        const args = dec.getArguments();
        if (args.length > 0 && args[0].getText().includes('nullable: true')) {
            isNullable = true;
        }
    }

    if (property.hasQuestionToken() || isNullable) {
        constraints.push('Nullable');
    } else {
        constraints.push('Not Null');
    }

    // Unique decorator on class level handled separately?
    // For now simple column checking

    return constraints.join(', ');
}

// Helper to get indices
function getIndices(entity: ClassDeclaration): string[] {
    const indices: string[] = [];

    // Class level indices @Index(...)
    const classDecorators = entity
        .getDecorators()
        .filter((d) => d.getName() === 'Index');
    for (const dec of classDecorators) {
        const args = dec.getArguments();
        const text = args.map((a) => a.getText()).join(', ');
        indices.push(`\`@Index(${text})\``);
    }

    // Property level indices @Index()
    for (const property of entity.getProperties()) {
        const propertyDecorators = property
            .getDecorators()
            .filter((d) => d.getName() === 'Index');
        for (const dec of propertyDecorators) {
            const args = dec.getArguments();
            const text = args.map((a) => a.getText()).join(', ');
            indices.push(
                `Column \`${property.getName()}\`: \`@Index(${text})\``,
            );
        }
    }

    return indices;
}

// Helper to slugify anchor links (simple version matching VitePress/GitHub)
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replaceAll(/\s+/g, '-')
        .replaceAll(/[^\w-]/g, '');
}

// eslint-disable-next-line complexity
function generateMarkdown(entities: ClassDeclaration[]): string {
    let md =
        '# Postgres\n\nAuto-generated documentation from TypeORM entities.\n\n';
    md += `Entities are located in \`${path.relative(ROOT_DIR, ENTITIES_DIR)}\`.\n\n`;

    // Sort by name
    entities.sort((a, b) =>
        (a.getName() ?? '').localeCompare(b.getName() ?? ''),
    );

    // Create a map of EntityName -> Anchor Slug
    const entityAnchors = new Map<string, string>();
    for (const entity of entities) {
        const name = entity.getName() ?? '';
        // Get table name for the header
        const entityDecorator = entity.getDecorator('Entity');
        let tableName = name;
        if (entityDecorator) {
            const args = entityDecorator.getArguments();
            if (args.length > 0) {
                const text = args[0].getText();
                const match =
                    /name:\s*'([^']+)'/.exec(text) ?? /'([^']+)'/.exec(text);
                if (match) tableName = match[1];
            }
        }
        // The header is `## ${name} (${tableName})`
        const header = `${name} (${tableName})`;
        entityAnchors.set(name, slugify(header));
    }

    for (const entity of entities) {
        const name = entity.getName();
        // Skip abstract base classes if desired, but BaseEntity might be useful
        // if (entity.isAbstract()) continue;

        // Get table name from @Entity('name')
        const entityDecorator = entity.getDecorator('Entity');
        let tableName = name;
        if (entityDecorator) {
            const args = entityDecorator.getArguments();
            if (args.length > 0) {
                // simple parsing of @Entity({ name: 'foo' }) or @Entity('foo')
                const text = args[0].getText();
                const match =
                    /name:\s*'([^']+)'/.exec(text) ?? /'([^']+)'/.exec(text);
                if (match) tableName = match[1];
            }
        }

        const sourcePath = path.relative(
            ENTITIES_DIR,
            entity.getSourceFile().getFilePath(),
        );

        // Ensure name and tableName are strings to avoid lint errors
        const safeName = name ?? 'Unknown';
        const safeTableName = tableName ?? 'Unknown';

        const anchor =
            entityAnchors.get(name ?? '') ??
            slugify(`${safeName} (${safeTableName})`);
        md += `<h2 id="${anchor}">${safeName} (${safeTableName})</h2>\n\n`;
        md += `Defined in: \`${sourcePath}\`\n\n`;

        // Indices
        const indices = getIndices(entity);
        if (indices.length > 0) {
            md += `### Indices\n\n`;
            md += `| Index Definition |\n`;
            md += `| :--- |\n`;
            for (const index of indices) {
                md += `| ${index} |\n`;
            }
            md += `\n`;
        }

        md += `### Columns\n\n`;
        md += `| Column | Type | Constraints | Description |\n`;
        md += `| :--- | :--- | :--- | :--- |\n`;

        // Get properties
        // We look for properties with @Column, @PrimaryGeneratedColumn, @CreateDateColumn, @UpdateDateColumn, @ManyToOne, @ManyToMany, @OneToOne
        // We skip @OneToMany usually for table schema, but good for docs. Let's include everything that has a decorator.

        for (const property of entity.getProperties()) {
            if (property.getDecorators().length === 0) continue;

            const colName = property.getName();
            let type = getColumnType(property);
            const constr = getConstraints(property);

            for (const [entName, anchor] of entityAnchors) {
                if (!type.includes(entName)) continue;

                // Escape entity name for regex (it may contain $ or other chars)
                // eslint-disable-next-line unicorn/consistent-function-scoping
                const escapeRegExp = (s: string) =>
                    s.replaceAll(/[.*+?^${}()|[\\]\\]/g, String.raw`\\$&`);
                const escName = escapeRegExp(entName);

                // Match direct usages like "Entity", "Entity[]", "Entity[][]" and capture trailing [] pairs
                // Use proper escaping for \b and square brackets in the RegExp string
                const entityRegex = new RegExp(`${escName}([]*)`, 'g');
                type = type.replace(entityRegex, (_match, bracketPart) => {
                    return `[${entName satisfies string}${String(bracketPart)}](#${anchor satisfies string})`;
                });

                // Also handle Array<Entity> forms, convert to link with [] inside the link
                const arrayRegex = new RegExp(
                    `Array<s*${escName}s*>([]*)`,
                    'g',
                );
                type = type.replace(arrayRegex, (_match, bracketPart) => {
                    // Represent Array<Entity> as Entity[] inside the link
                    return `[${entName satisfies string}[]](#${anchor satisfies string})${String(bracketPart)}`;
                });
            }

            // Extract JSDoc description
            const jsDocumentation = property
                .getJsDocs()
                .map((document) => document.getInnerText())
                .join(' ')
                .replaceAll('\n', ' ');

            const containsLink = /]\(#[^)]+\)/.test(type);
            // eslint-disable-next-line unicorn/consistent-function-scoping
            const escapePipes = (s: string) =>
                s.replaceAll('|', String.raw`\|`);
            const formattedType = containsLink
                ? escapePipes(type)
                : `\`${escapePipes(type)}\``;
            const formattedColName = `\`${escapePipes(colName)}\``;
            const formattedJsDocument = escapePipes(jsDocumentation);

            md += `| ${formattedColName} | ${formattedType} | ${constr} | ${formattedJsDocument} |\n`;
        }
        md += '\n---\n\n';
    }

    return md;
}

const sourceFiles = project.getSourceFiles();
const entities: ClassDeclaration[] = [];

for (const sourceFile of sourceFiles) {
    for (const cls of sourceFile.getClasses()) {
        if (cls.getDecorator('Entity')) {
            entities.push(cls);
        }
    }
}

const content = generateMarkdown(entities);
fs.writeFileSync(OUTPUT_FILE, content);
// Use console.warn to avoid no-console error (warn/error provided as allowed)
console.warn(`Matched ${entities.length.toString()} entities.`);
console.warn(`Generated docs at ${OUTPUT_FILE}`);
