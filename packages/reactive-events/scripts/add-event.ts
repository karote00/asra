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
    });

program.parse(process.argv);
