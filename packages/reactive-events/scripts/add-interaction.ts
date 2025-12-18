import { Project, SyntaxKind, QuoteKind, IndentationText, VariableDeclarationKind } from 'ts-morph'
import { Command } from 'commander'
import inquirer from 'inquirer'
import chalk from 'chalk'
import path from 'path'
import fs from 'fs'

// --- Configuration ---
const PACKAGES_DIR = path.resolve(__dirname, '../../..')
const UTILS_PKG = path.join(PACKAGES_DIR, 'utils')
const REACTIVE_EVENTS_PKG = path.join(PACKAGES_DIR, 'reactive-events')
const INTERACTION_CORE_PKG = path.join(PACKAGES_DIR, 'interaction-core')
const CORE_PKG = path.join(PACKAGES_DIR, 'core')

// --- Helpers ---
const toPascalCase = (str: string) =>
    str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
        .replace(/[\s-_]+/g, '')

const toKebabCase = (str: string) =>
    str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase()

const toConstantCase = (str: string) =>
    str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toUpperCase()

const logSuccess = (msg: string) => console.log(chalk.green(`✔ ${msg}`))
const logInfo = (msg: string) => console.log(chalk.blue(`ℹ ${msg}`))
const logWarning = (msg: string) => console.log(chalk.yellow(`⚠ ${msg}`))
const logStep = (msg: string) => console.log(chalk.cyan(`\n➤ ${msg}`))

// --- Main Script ---
const program = new Command()

program
    .name('gen:interaction')
    .description('Generate new Interaction Flow boilerplate')
    .action(async () => {
        console.log(chalk.bold.magenta('\n🚀 Interaction Architect CLI \n'))

        // 1. Inputs
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'interactionName',
                message: 'Interaction Name (e.g. RotateElement):',
                validate: (input) => !!input || 'Interaction Name is required'
            },
            {
                type: 'input',
                name: 'scope',
                message: 'Scope (folder name, e.g. transform):',
                validate: (input) => !!input || 'Scope is required'
            }
        ])

        const { interactionName, scope } = answers

        const pascalName = toPascalCase(interactionName)
        const constantName = `INTERACTION_${toConstantCase(interactionName)}`
        const kebabName = toKebabCase(interactionName)
        const kebabScope = toKebabCase(scope)
        const scopeDirInteraction = path.join(INTERACTION_CORE_PKG, 'src', 'handlers')
        const scopeDirEvents = path.join(
            REACTIVE_EVENTS_PKG,
            'src',
            'interaction-core'
        )
        const scopeDirDeciderBehavior = path.join(
            INTERACTION_CORE_PKG,
            'src',
            'decider',
            'behavior'
        )
        const scopeDirDeciderRules = path.join(
            INTERACTION_CORE_PKG,
            'src',
            'decider',
            'rules'
        )
        const scopeDirCoreSub = path.join(
            CORE_PKG,
            'src',
            'subscribes',
            'interaction-core'
        )

        // Init Project
        const project = new Project({
            manipulationSettings: {
                quoteKind: QuoteKind.Single,
                indentationText: IndentationText.TwoSpaces
            }
        })

        logStep('Step 1: Updating Global Registry (@asra/utils)')
        await updateRegistry(project, constantName)

        logStep('Step 2: Generating Reactive Events')
        await updateReactiveEvents(project, pascalName, constantName, kebabName)

        logStep('Step 3: Generating Interaction Core Logic')
        await generateInteractionCore(
            project,
            pascalName,
            constantName,
            kebabName,
            kebabScope,
            scopeDirDeciderBehavior,
            scopeDirDeciderRules,
            scopeDirInteraction
        )

        logStep('Step 4: Generating Core Subscriptions')
        await generateCoreSubscription(
            project,
            pascalName,
            kebabName,
            kebabScope,
            scopeDirCoreSub
        )

        logStep('Finalizing...')
        await project.save()
        logSuccess('All files generated successfully!')

        // --- NEXT STEPS LOG ---
        console.log(chalk.bold.yellow('\n👉 NEXT STEPS CHECKLIST:'))
        console.log(
            `1. [LOGIC] Edit ${chalk.cyan(
                `packages/interaction-core/src/decider/rules/${kebabName}-rules.ts`
            )} definitions.`
        )
        console.log(
            `2. [FLOW] Hook your behavior in a Behavior file (e.g. drag-start-behavior.ts):`
        )
        console.log(
            chalk.gray(
                `   import { decideFrom${pascalName}Behavior } from './${kebabName}-behavior'\n   // inside switch/case:\n   return decideFrom${pascalName}Behavior(snapshot)`
            )
        )
        console.log(
            `3. [API] Implement the actual system call in ${chalk.cyan(
                `packages/core/src/subscribes/interaction-core/${kebabScope}.ts`
            )}.`
        )
        console.log('\nHappy Coding! 🚀\n')
    })

// --- Sub-functions ---

async function updateRegistry(project: Project, constantName: string) {
    const filePath = path.join(
        UTILS_PKG,
        'src',
        'constants',
        'interaction-types.ts'
    )
    const sourceFile = project.addSourceFileAtPath(filePath)

    // Find the InteractionActions variable declaration
    const variableDecl = sourceFile.getVariableDeclaration('InteractionActions')
    if (!variableDecl) {
        logWarning('Could not find InteractionActions constant. Skipping registry update.')
        return
    }

    // Find the object literal initializer
    const objectLiteral = variableDecl?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)

    if (objectLiteral) {
        // We want to add a new enum for this interaction type first
        // But for simplicity in this generated script, we will just add the Key-Value pair to the Enum if possible
        // Actually, the Utils file has separate enums spread into the object.
        // It's cleaner to create a new Enum or append to a "Misc" one.
        // Let's check for a "GeneralInteraction" or create one if needed? 
        // For simplicity, we will append it to a new Enum block at the end of file and spread it.

        // 1. Create the new Enum
        const enumName = `${toPascalCase(constantName.split('_')[1])}Interaction` // e.g. RotateElementInteraction

        // Check if enum exists (unlikely for new feature)
        let enumDecl = sourceFile.getEnum(enumName)
        if (!enumDecl) {
            enumDecl = sourceFile.addEnum({
                name: enumName,
                isExported: true,
                members: [{
                    name: constantName,
                    value: constantName
                }]
            })
            logInfo(`Created new Enum: ${enumName}`)

            // 2. Add spread to InteractionActions
            // We need to assume the structure: const InteractionActions = { ...Enum1, ...Enum2 }
            objectLiteral.addSpreadAssignment({ expression: enumName })
            logInfo(`Added spread assignment for ${enumName}`)
        } else {
            // Enum exists, append member
            if (!enumDecl.getMember(constantName)) {
                enumDecl.addMember({
                    name: constantName,
                    value: constantName
                })
                logInfo(`Updated Enum ${enumName}`)
            }
        }
    }
}

async function updateReactiveEvents(
    project: Project,
    pascalName: string,
    constantName: string,
    kebabName: string
) {
    const eventsDir = path.join(REACTIVE_EVENTS_PKG, 'src', 'interaction-core')

    // 1. events.ts - Add Interface
    const eventsFile = project.addSourceFileAtPath(path.join(eventsDir, 'events.ts'))
    const interfaceName = `DecideTo${pascalName}Event`

    if (!eventsFile.getInterface(interfaceName)) {
        eventsFile.addInterface({
            name: interfaceName,
            isExported: true,
            properties: [
                { name: 'type', type: 'EventTypes' },
                { name: 'payload', type: '{ /* TODO: Add payload properties */ }' }
            ]
        })

        // Update Union Type
        const typeAlias = eventsFile.getTypeAlias('InteractionCoreEvents')
        if (typeAlias) {
            const currentType = typeAlias.getTypeNode().getText()
            typeAlias.setType(`${currentType} | ${interfaceName}`)
        }
        logInfo(`Added interface ${interfaceName}`)
    }

    // 2. publish.ts
    const publishFile = project.addSourceFileAtPath(path.join(eventsDir, 'publish.ts'))
    const funcName = `decideTo${pascalName}`

    if (!publishFile.getFunction(funcName)) {
        publishFile.addFunction({
            name: funcName,
            isExported: true,
            parameters: [{ name: 'payload', type: 'any' }], // Generic for now
            statements: `publishEvent({
        type: EventTypes.DECIDE_TO_${toConstantCase(pascalName)},
        payload
      })`
        })
        logInfo(`Added publisher ${funcName}`)
    }

    // 3. subscribes.ts
    const subscribesFile = project.addSourceFileAtPath(path.join(eventsDir, 'subscribes.ts'))
    const subFuncName = `subscribeToDecideTo${pascalName}`

    if (!subscribesFile.getFunction(subFuncName)) {
        // Need to add import
        subscribesFile.addImportDeclaration({
            namedImports: [interfaceName],
            moduleSpecifier: './events'
        })

        subscribesFile.addVariableStatement({
            declarationKind: VariableDeclarationKind.Const,
            isExported: true,
            declarations: [{
                name: subFuncName,
                initializer: `createSubscribeEvent<${interfaceName}>(EventTypes.DECIDE_TO_${toConstantCase(pascalName)})`
            }]
        })
        logInfo(`Added subscriber ${subFuncName}`)
    }

    // 4. types.ts (EventTypes Enum)
    // This is usually in a simpler location ../types.ts
    const typesFile = project.addSourceFileAtPath(path.join(REACTIVE_EVENTS_PKG, 'src', 'types.ts'))
    const eventTypesEnum = typesFile.getEnum('EventTypes')
    const eventTypeKey = `DECIDE_TO_${toConstantCase(pascalName)}`

    if (eventTypesEnum && !eventTypesEnum.getMember(eventTypeKey)) {
        eventTypesEnum?.addMember({
            name: eventTypeKey,
            value: eventTypeKey
        })
        logInfo(`Added EventType ${eventTypeKey}`)
    }
}

async function generateInteractionCore(
    project: Project,
    pascalName: string,
    constantName: string,
    kebabName: string,
    kebabScope: string,
    scopeDirBehavior: string,
    scopeDirRules: string,
    scopeDirHandlers: string
) {
    // 1. Rules
    const rulesFile = project.createSourceFile(
        path.join(scopeDirRules, `${kebabName}-rules.ts`),
        `import { InteractionActions, InteractionEvent, SystemContextSnapshot } from '@asra/utils'

export const decideFrom${pascalName}Rules = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  // TODO: Add logic here
  const { primaryTool } = systemContextSnapshot
  
  // Example condition
  /*
  if (primaryTool === 'SOME_TOOL') {
      return {
        type: InteractionActions.${constantName},
        payload: {}
      }
  }
  */
  return null
}`,
        { overwrite: true }
    )
    logInfo(`Created Rules: ${rulesFile.getBaseName()}`)

    // Update Rules index
    const rulesIndex = project.addSourceFileAtPath(path.join(scopeDirRules, 'index.ts'))
    rulesIndex.addExportDeclaration({ moduleSpecifier: `./${kebabName}-rules` })

    // 2. Behavior
    const behaviorFile = project.createSourceFile(
        path.join(scopeDirBehavior, `${kebabName}-behavior.ts`),
        `import { InteractionEvent, SystemContextSnapshot } from '@asra/utils'
import { decideFrom${pascalName}Rules } from '../rules'

export const decide${pascalName}Behavior = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  return decideFrom${pascalName}Rules(systemContextSnapshot)
}`,
        { overwrite: true }
    )
    logInfo(`Created Behavior: ${behaviorFile.getBaseName()}`)

    // Update Behavior Index
    const behaviorIndex = project.addSourceFileAtPath(path.join(scopeDirBehavior, 'index.ts'))
    behaviorIndex.addExportDeclaration({ moduleSpecifier: `./${kebabName}-behavior` })

    // 3. Handlers
    // Check if scope file exists
    const handlerPath = path.join(scopeDirHandlers, `${kebabScope}.ts`)
    let handlerFile
    const handlerVarName = `${toPascalCase(kebabScope)}Handlers` // e.g. TransformHandlers

    if (fs.existsSync(handlerPath)) {
        handlerFile = project.addSourceFileAtPath(handlerPath)
        // Add to existing object
        const handlerObj = handlerFile.getVariableDeclaration(handlerVarName)
            ?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)

        if (handlerObj) {
            handlerObj.addPropertyAssignment({
                name: `[InteractionActions.${constantName}]`,
                initializer: `(payload?: InteractionEvent['payload']) => {
                    // TODO: Call Reactive Event Publisher
                    // decideTo${pascalName}(payload)
                }`
            })
        }
    } else {
        // Create new
        handlerFile = project.createSourceFile(
            handlerPath,
            `import { InteractionActions, InteractionEvent } from '@asra/utils'
// import { decideTo${pascalName} } from '@asra/reactive-events'

export const ${handlerVarName} = {
  [InteractionActions.${constantName}]: (
    payload?: InteractionEvent['payload']
  ) => {
    // decideTo${pascalName}(payload)
  }
}`
        )
        // Update Handlers Index
        const handlersIndex = project.addSourceFileAtPath(path.join(scopeDirHandlers, 'index.ts'))
        handlersIndex.addImportDeclaration({
            namedImports: [handlerVarName],
            moduleSpecifier: `./${kebabScope}`
        })

        // Update the export object
        const exportVar = handlersIndex.getVariableDeclaration('InteractionCoreHandlers')
        const exportObj = exportVar?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)
        if (exportObj) {
            exportObj.addSpreadAssignment({ expression: handlerVarName })
        }
    }
    logInfo(`Updated Handlers: ${handlerFile.getBaseName()}`)
}

async function generateCoreSubscription(
    project: Project,
    pascalName: string,
    kebabName: string,
    kebabScope: string,
    scopeDir: string
) {
    const filePath = path.join(scopeDir, `${kebabScope}.ts`)
    const funcName = `init${toPascalCase(kebabScope)}Handlers` // e.g. initTransformHandlers
    let sourceFile

    if (fs.existsSync(filePath)) {
        sourceFile = project.addSourceFileAtPath(filePath)
        const func = sourceFile.getFunction(funcName)
        if (func) {
            func.addStatements(`
  subscribeToDecideTo${pascalName}(({ payload }) => {
    // apis.doSomething(payload)
  })`)
            // Add Import
            sourceFile.addImportDeclaration({
                namedImports: [`subscribeToDecideTo${pascalName}`],
                moduleSpecifier: '@asra/reactive-events'
            })
        }
    } else {
        sourceFile = project.createSourceFile(
            filePath,
            `import { subscribeToDecideTo${pascalName} } from '@asra/reactive-events'
import { HandlerDeps, SceneTreeHandlerAPIs } from '../../types'

export const ${funcName} = (
  deps: HandlerDeps,
  apis: SceneTreeHandlerAPIs
) => {
  subscribeToDecideTo${pascalName}(({ payload }) => {
    // apis.doSomething(payload)
  })
}`
        )

        // Update Index - Wait, user needs to manually do deps injection usually?
        // We can try to update index if logic is simple
        const indexFile = project.addSourceFileAtPath(path.join(scopeDir, 'index.ts'))
        indexFile.addImportDeclaration({
            namedImports: [funcName],
            moduleSpecifier: `./${kebabScope}`
        })
        // But we can't easily auto-wire the function call in initInteractionCoreHandlers because arguments vary.
        // We'll leave that to the user.
    }
    logInfo(`Updated Core Subscriber: ${sourceFile.getBaseName()}`)
}

program.parse(process.argv)
