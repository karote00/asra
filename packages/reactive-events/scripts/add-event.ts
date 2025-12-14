import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import { Project } from 'ts-morph';

const program = new Command();

program
    .name('add-event')
    .description('Automate adding new events to reactive-events package')
    .option('-n, --name <name>', 'Event Name (CamelCase, e.g. UpdateNode)')
    .option('-s, --scope <scope>', 'Target Folder (kebab-case, e.g. scene-tree)')
    .option('-p, --pattern <pattern>', 'simple (default) OR async', 'simple')
    .option('--payload <payload>', 'JSON Schema or Interface string')
    .option('--options <options>', 'JSON Schema or Interface string')
    .action(async (opts) => {
        const questions = [];
        if (!opts.name) {
            questions.push({
                type: 'input',
                name: 'name',
                message: 'Event Name (CamelCase, e.g. UpdateNode):',
                validate: (input: string) => !!input || 'Name is required'
            });
        }
        if (!opts.scope) {
            questions.push({
                type: 'input',
                name: 'scope',
                message: 'Scope (kebab-case, e.g. scene-tree):',
                validate: (input: string) => !!input || 'Scope is required'
            });
        }

        const answers = await inquirer.prompt(questions);
        const config = { ...opts, ...answers };

        console.log(chalk.blue('Configuration:'));
        console.log(config);

        if (!['simple', 'async'].includes(config.pattern)) {
            console.error(chalk.red('Pattern must be simple or async'));
            process.exit(1);
        }


        // Logic starts here
        const project = new Project();
        const typesPath = path.resolve(__dirname, '../src/types.ts');
        const sourceFile = project.addSourceFileAtPath(typesPath);

        const pascalScope = config.scope.split('-').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
        const enumName = `${pascalScope}EventTypes`;
        const enumDecl = sourceFile.getEnum(enumName);

        if (!enumDecl) {
            console.error(chalk.red(`Enum ${enumName} not found in types.ts`));
            process.exit(1);
        }

        const eventNamePascal = config.name.charAt(0).toUpperCase() + config.name.slice(1);
        const eventNameCamel = config.name.charAt(0).toLowerCase() + config.name.slice(1);
        const eventNameConstant = config.name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();

        // 1. Add Main Event
        // Check if exists
        if (enumDecl.getMember(eventNameConstant)) {
            console.warn(chalk.yellow(`Event ${eventNameConstant} already exists in ${enumName}. Skipping.`));
        } else {
            enumDecl.addMember({
                name: eventNameConstant,
                value: eventNameCamel
            });
            console.log(chalk.green(`Added ${eventNameConstant} to ${enumName}`));
        }

        // 2. Add Finish Event if async
        if (config.pattern === 'async') {
            const finishConstant = `FINISH_${eventNameConstant}`;
            const finishValue = `finish${eventNamePascal}`;
            if (enumDecl.getMember(finishConstant)) {
                console.warn(chalk.yellow(`Event ${finishConstant} already exists in ${enumName}. Skipping.`));
            } else {
                enumDecl.addMember({
                    name: finishConstant,
                    value: finishValue
                });
                console.log(chalk.green(`Added ${finishConstant} to ${enumName}`));
            }
        }


        await sourceFile.save();

        // 2. Definition Update (src/[scope]/events.ts)
        const eventsPath = path.resolve(__dirname, `../src/${config.scope}/events.ts`);
        const eventsSourceFile = project.addSourceFileAtPathIfExists(eventsPath);

        if (!eventsSourceFile) {
            console.error(chalk.red(`File not found: ${eventsPath}`));
            // We stop here for now as creating a new scope is out of current spec scope (requires more scaffolding)
            process.exit(1);
        }

        const eventInterfaceName = `${eventNamePascal}Event`;
        const finishEventInterfaceName = `Finish${eventNamePascal}Event`;

        // Prepare Payload Type String
        let payloadTypeString = config.payload;

        // Helper to merge requestId if async
        const mergeRequestId = (typeStr?: string) => {
            if (!typeStr) return '{\n    requestId: string\n  }';
            const trimmed = typeStr.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                // Insert requestId at start
                return `{\n    requestId: string\n    ${trimmed.slice(1, -1)}\n  }`;
            }
            return `{ requestId: string } & ${typeStr}`;
        };

        // Main Event Interface
        const mainEventInterface = eventsSourceFile.addInterface({
            name: eventInterfaceName,
            isExported: true,
            properties: [
                { name: 'type', type: 'EventTypes' }
            ]
        });

        if (config.pattern === 'async') {
            mainEventInterface.addProperty({
                name: 'payload',
                type: mergeRequestId(payloadTypeString)
            });
        } else if (payloadTypeString) {
            mainEventInterface.addProperty({
                name: 'payload',
                type: payloadTypeString
            });
        }

        if (config.options) {
            mainEventInterface.addProperty({
                name: 'options',
                type: config.options
            });
        }
        console.log(chalk.green(`Added interface ${eventInterfaceName}`));

        // Finish Event Interface (if async)
        if (config.pattern === 'async') {
            const finishInterface = eventsSourceFile.addInterface({
                name: finishEventInterfaceName,
                isExported: true,
                properties: [
                    { name: 'type', type: 'EventTypes' },
                    { name: 'payload', type: '{\n    requestId: string\n  }' } // Default simple payload for finish
                ]
            });
            console.log(chalk.green(`Added interface ${finishEventInterfaceName}`));
        }

        // Append to Union Type
        // Union name usage: PascalScope + "Events"
        const unionName = `${pascalScope}Events`;
        const unionTypeAlias = eventsSourceFile.getTypeAlias(unionName);

        if (unionTypeAlias) {
            const currentType = unionTypeAlias.getTypeNode()!.getText();
            let newType = currentType;

            // Add Main
            if (!currentType.includes(eventInterfaceName)) {
                newType += `\n  | ${eventInterfaceName}`;
            }
            // Add Finish
            if (config.pattern === 'async' && !currentType.includes(finishEventInterfaceName)) {
                newType += `\n  | ${finishEventInterfaceName}`;
            }

            unionTypeAlias.setType(newType);
            console.log(chalk.green(`Updated union type ${unionName}`));
        } else {
            console.warn(chalk.yellow(`Union type ${unionName} not found. Skipped updating union.`));
        }

        await eventsSourceFile.save();
    });

program.parse(process.argv);
