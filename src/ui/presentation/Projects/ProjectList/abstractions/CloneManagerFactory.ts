import { createAbstraction } from "#shared/index.js";

export interface ICloneManager {
    url: string;
    folderName: string;
    loading: boolean;
    error: string | null;
    setUrl: (url: string) => void;
    setFolderName: (name: string) => void;
    clone: () => Promise<void>;
}

export interface ICloneManagerFactoryInput {
    getBrowsePath: () => string;
    onCloned: () => Promise<void>;
}

export interface ICloneManagerFactory {
    create(input: ICloneManagerFactoryInput): ICloneManager;
}

export const CloneManagerFactory =
    createAbstraction<ICloneManagerFactory>("Ui/CloneManagerFactory");

export namespace CloneManagerFactory {
    export type Interface = ICloneManagerFactory;
    export type Input = ICloneManagerFactoryInput;
    export type Manager = ICloneManager;
}
