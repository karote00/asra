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

        // Logic will go here
    });

program.parse(process.argv);
