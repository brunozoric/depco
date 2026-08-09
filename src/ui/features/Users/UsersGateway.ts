import { UsersGateway as Abstraction } from "./abstractions/UsersGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import { cleanQuery } from "../../httpClient/cleanQuery.js";
import {
    listUsersRoute,
    getUserRoute,
    createUserRoute,
    updateUserRoute,
    deleteUserRoute,
    forceLogoutUserRoute
} from "#shared/routes/index.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT_BY = "createdAt";
const DEFAULT_SORT_ORDER = "desc";

class UsersGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(query?: Abstraction.ListQuery): Promise<Abstraction.ListResponse> {
        return this.httpClient.request(listUsersRoute, {
            params: {},
            query: cleanQuery({
                search: query?.search,
                isActive: query?.isActive,
                page: query?.page ?? DEFAULT_PAGE,
                pageSize: query?.pageSize ?? DEFAULT_PAGE_SIZE,
                sortBy: query?.sortBy ?? DEFAULT_SORT_BY,
                sortOrder: query?.sortOrder ?? DEFAULT_SORT_ORDER
            })
        });
    }

    public async getById(id: string): Promise<Abstraction.User> {
        const response = await this.httpClient.request(getUserRoute, { params: { id } });
        return response.item;
    }

    public async create(body: Abstraction.CreateInput): Promise<Abstraction.User> {
        const response = await this.httpClient.request(createUserRoute, { params: {}, body });
        return response.item;
    }

    public async update(id: string, body: Abstraction.UpdateInput): Promise<Abstraction.User> {
        const response = await this.httpClient.request(updateUserRoute, {
            params: { id },
            body
        });
        return response.item;
    }

    public async remove(id: string): Promise<void> {
        await this.httpClient.request(deleteUserRoute, { params: { id } });
    }

    public async forceLogout(id: string): Promise<void> {
        await this.httpClient.request(forceLogoutUserRoute, { params: { id } });
    }
}

export const UsersGateway = Abstraction.createImplementation({
    implementation: UsersGatewayImpl,
    dependencies: [HTTPClient]
});
