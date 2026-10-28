import { existsSync, readdirSync, readFileSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { parseSync } from "oxc-parser";

// Statically finds DI singletons whose instances change after construction.
// A singleton is shared by every request, so any field it mutates after the
// constructor is shared state — a leak risk if request data ever lands there.

export interface ISingletonMutableState {
    // Implementation class name, e.g. "JobWorkerImpl".
    className: string;
    // Source file holding the class, relative to the repo root.
    file: string;
    // Fields mutated outside the constructor, sorted.
    fields: string[];
}

interface IAstNode {
    type: string;
    start: number;
    end: number;
    [key: string]: unknown;
}

interface IFindSingletonMutableStateParams {
    rootDirectory: string;
    sourceDirectory: string;
}

interface IResolveImportParams {
    fromFile: string;
    specifier: string;
    rootDirectory: string;
}

interface IFindImplementationClassParams {
    program: IAstNode;
    exportName: string;
}

interface ISingletonRegistration {
    registrationName: string;
    implementationFile: string;
}

const MUTATING_METHODS = new Set([
    "set",
    "add",
    "delete",
    "clear",
    "push",
    "pop",
    "shift",
    "unshift",
    "splice"
]);

const ALIAS_PREFIXES = new Map([
    ["#api/", "src/api/"],
    ["#shared/", "src/shared/"],
    ["#testing/", "src/testing/"]
]);

function isNode(value: unknown): value is IAstNode {
    return typeof value === "object" && value !== null && "type" in value;
}

function children(node: IAstNode): IAstNode[] {
    const result: IAstNode[] = [];
    for (const [key, value] of Object.entries(node)) {
        if (key === "parent") {
            continue;
        }
        if (Array.isArray(value)) {
            result.push(...value.filter(isNode));
        } else if (isNode(value)) {
            result.push(value);
        }
    }
    return result;
}

function visit(node: IAstNode, callback: (node: IAstNode) => boolean | void): void {
    if (callback(node) === false) {
        return;
    }
    for (const child of children(node)) {
        visit(child, callback);
    }
}

function parse(file: string): IAstNode {
    const { program } = parseSync(file, readFileSync(file, "utf8"));
    return program as unknown as IAstNode;
}

function listFeatureFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== "__tests__") {
                files.push(...listFeatureFiles(path));
            }
        } else if (entry.name === "feature.ts") {
            files.push(path);
        }
    }
    return files;
}

function resolveImport({
    fromFile,
    specifier,
    rootDirectory
}: IResolveImportParams): string | null {
    let base: string | null = null;
    if (specifier.startsWith(".")) {
        base = resolve(dirname(fromFile), specifier);
    } else {
        for (const [alias, target] of ALIAS_PREFIXES) {
            if (specifier.startsWith(alias)) {
                base = resolve(rootDirectory, target + specifier.slice(alias.length));
            }
        }
    }
    if (!base) {
        return null;
    }
    const withoutExtension = base.replace(/\.js$/, "");
    for (const candidate of [`${withoutExtension}.ts`, join(withoutExtension, "index.ts")]) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

function identifierName(node: unknown): string | null {
    if (isNode(node) && (node.type === "Identifier" || node.type === "PrivateIdentifier")) {
        const name = node["name"];
        if (typeof name === "string") {
            return node.type === "PrivateIdentifier" ? `#${name}` : name;
        }
    }
    return null;
}

// Finds `container.register(X).inSingletonScope()` calls in a feature file and
// maps each X to the file it is imported from.
function findSingletonRegistrations(
    featureFile: string,
    rootDirectory: string
): ISingletonRegistration[] {
    const program = parse(featureFile);
    const importedFrom = new Map<string, string>();
    for (const statement of children(program)) {
        if (statement.type !== "ImportDeclaration" || !isNode(statement["source"])) {
            continue;
        }
        const specifier = statement["source"]["value"];
        const specifiers = statement["specifiers"];
        if (typeof specifier !== "string" || !Array.isArray(specifiers)) {
            continue;
        }
        for (const importSpecifier of specifiers.filter(isNode)) {
            const localName = identifierName(importSpecifier["local"]);
            const importedName = identifierName(importSpecifier["imported"]) ?? localName;
            if (localName && importedName) {
                importedFrom.set(localName, `${importedName}\u0000${specifier}`);
            }
        }
    }

    const registrations: ISingletonRegistration[] = [];
    visit(program, node => {
        if (node.type !== "CallExpression" || !isNode(node["callee"])) {
            return;
        }
        const callee = node["callee"];
        if (identifierName(callee["property"]) !== "inSingletonScope") {
            return;
        }
        const registerCall = callee["object"];
        if (!isNode(registerCall) || registerCall.type !== "CallExpression") {
            return;
        }
        const registerArguments = registerCall["arguments"];
        const localName = Array.isArray(registerArguments)
            ? identifierName(registerArguments[0])
            : null;
        const source = localName ? importedFrom.get(localName) : undefined;
        if (!source) {
            return;
        }
        const [registrationName, specifier] = source.split("\u0000");
        const implementationFile = resolveImport({
            fromFile: featureFile,
            specifier: specifier!,
            rootDirectory
        });
        if (registrationName && implementationFile) {
            registrations.push({ registrationName, implementationFile });
        }
    });
    return registrations;
}

// Follows `export const X = Abstraction.createImplementation({ implementation: XImpl })`
// to the XImpl class declaration.
function findImplementationClass({
    program,
    exportName
}: IFindImplementationClassParams): IAstNode | null {
    let className: string | null = null;
    visit(program, node => {
        if (node.type !== "VariableDeclarator" || identifierName(node["id"]) !== exportName) {
            return;
        }
        visit(node, inner => {
            if (inner.type === "Property" && identifierName(inner["key"]) === "implementation") {
                className = identifierName(inner["value"]);
            }
        });
    });

    let found: IAstNode | null = null;
    visit(program, node => {
        if (node.type === "ClassDeclaration" && identifierName(node["id"]) === className) {
            found = node;
        }
    });
    return found;
}

function thisMemberName(node: unknown): string | null {
    if (isNode(node) && node.type === "MemberExpression" && isNode(node["object"])) {
        if (node["object"].type === "ThisExpression") {
            return identifierName(node["property"]);
        }
    }
    return null;
}

function isConstructor(node: IAstNode): boolean {
    return node.type === "MethodDefinition" && node["kind"] === "constructor";
}

function findMutatedFields(classNode: IAstNode): string[] {
    const fields = new Set<string>();
    visit(classNode, node => {
        if (isConstructor(node)) {
            return false;
        }
        if (node.type === "AssignmentExpression") {
            const name = thisMemberName(node["left"]);
            if (name) {
                fields.add(name);
            }
        }
        if (node.type === "UpdateExpression") {
            const name = thisMemberName(node["argument"]);
            if (name) {
                fields.add(name);
            }
        }
        if (node.type === "CallExpression" && isNode(node["callee"])) {
            const callee = node["callee"];
            const method = identifierName(callee["property"]);
            const name = thisMemberName(callee["object"]);
            if (name && method && MUTATING_METHODS.has(method)) {
                fields.add(name);
            }
        }
        return true;
    });
    return [...fields].sort();
}

export function findSingletonMutableState({
    rootDirectory,
    sourceDirectory
}: IFindSingletonMutableStateParams): ISingletonMutableState[] {
    const results = new Map<string, ISingletonMutableState>();
    for (const featureFile of listFeatureFiles(resolve(rootDirectory, sourceDirectory))) {
        for (const registration of findSingletonRegistrations(featureFile, rootDirectory)) {
            const classNode = findImplementationClass({
                program: parse(registration.implementationFile),
                exportName: registration.registrationName
            });
            if (!classNode) {
                continue;
            }
            const className = identifierName(classNode["id"])!;
            const fields = findMutatedFields(classNode);
            if (fields.length > 0) {
                results.set(className, {
                    className,
                    file: relative(rootDirectory, registration.implementationFile),
                    fields
                });
            }
        }
    }
    return [...results.values()].sort((a, b) => a.className.localeCompare(b.className));
}
