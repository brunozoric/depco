import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { UserListFeature } from "./feature.js";
import type { UserListPresenter } from "./abstractions/UserListPresenter.js";

interface UserListProviderProps {
    children: (params: { presenter: UserListPresenter.Interface }) => React.ReactNode;
}

export function UserListProvider({ children }: UserListProviderProps): React.ReactNode {
    const { presenter } = useFeature(UserListFeature);
    return children({ presenter });
}
