import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { UserListFeature } from "./feature.js";
import type { UserListPresenter } from "./abstractions/UserListPresenter.js";

interface IUserListPresenterParams {
    presenter: UserListPresenter.Interface;
}

interface IUserListProviderProps {
    children: (params: IUserListPresenterParams) => React.ReactNode;
}

export function UserListProvider({ children }: IUserListProviderProps): React.ReactNode {
    const { presenter } = useFeature(UserListFeature);
    return children({ presenter });
}
