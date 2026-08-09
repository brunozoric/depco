import type React from "react";
import {
    Alert,
    Button,
    Center,
    Group,
    Paper,
    PasswordInput,
    PinInput,
    Stack,
    Tabs,
    Text,
    TextInput,
    Title
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { LoginPresenter } from "./abstractions/LoginPresenter.js";

interface LoginPageProps {
    presenter: LoginPresenter.Interface;
}

interface PasswordTabContentProps {
    presenter: LoginPresenter.Interface;
    vm: LoginPresenter.ViewModel;
}

function PasswordTabContent({ presenter, vm }: PasswordTabContentProps): React.ReactNode {
    if (vm.state === "credentials-submitted" || vm.state === "verifying-code") {
        return (
            <Stack gap="md">
                <Text size="sm" c="dimmed">
                    Enter the 6-digit code sent to {vm.email}.
                </Text>
                <Group justify="center">
                    <PinInput
                        length={6}
                        type="number"
                        value={vm.code}
                        onChange={value => presenter.setCode(value)}
                    />
                </Group>
                <Button
                    fullWidth
                    loading={vm.isLoading}
                    disabled={vm.code.length !== 6}
                    onClick={() => presenter.submitCode()}
                >
                    Verify Code
                </Button>
            </Stack>
        );
    }

    return (
        <Stack gap="md">
            <TextInput
                label="Email"
                placeholder="you@example.com"
                value={vm.email}
                onChange={event => presenter.setEmail(event.currentTarget.value)}
            />
            <PasswordInput
                label="Password"
                placeholder="Your password"
                value={vm.password}
                onChange={event => presenter.setPassword(event.currentTarget.value)}
            />
            <Button
                fullWidth
                loading={vm.isLoading}
                disabled={!vm.email || !vm.password}
                onClick={() => presenter.submitLogin()}
            >
                Sign in
            </Button>
        </Stack>
    );
}

function MagicLinkTabContent({ presenter, vm }: PasswordTabContentProps): React.ReactNode {
    if (vm.state === "magic-link-sent") {
        return (
            <Alert color="blue" title="Check your email">
                We sent a magic link to {vm.email}. Click it to sign in.
            </Alert>
        );
    }

    return (
        <Stack gap="md">
            <TextInput
                label="Email"
                placeholder="you@example.com"
                value={vm.email}
                onChange={event => presenter.setEmail(event.currentTarget.value)}
            />
            <Button
                fullWidth
                loading={vm.isLoading}
                disabled={!vm.email}
                onClick={() => presenter.submitMagicLink()}
            >
                Send Magic Link
            </Button>
        </Stack>
    );
}

export const LoginPage = observer(function LoginPage({
    presenter
}: LoginPageProps): React.ReactNode {
    const { vm } = presenter;

    return (
        <Center h="100vh">
            <Paper withBorder shadow="md" p="xl" radius="md" w={400}>
                <Stack gap="md">
                    <Title order={2} ta="center">
                        Sign in
                    </Title>

                    {vm.error && (
                        <Alert color="red" title="Error">
                            {vm.error}
                        </Alert>
                    )}

                    <Tabs
                        value={vm.activeTab}
                        onChange={value =>
                            presenter.setActiveTab(
                                value === "magic-link" ? "magic-link" : "password"
                            )
                        }
                    >
                        <Tabs.List grow>
                            <Tabs.Tab value="password">Email + Password</Tabs.Tab>
                            <Tabs.Tab value="magic-link">Magic Link</Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="password" pt="md">
                            <PasswordTabContent presenter={presenter} vm={vm} />
                        </Tabs.Panel>

                        <Tabs.Panel value="magic-link" pt="md">
                            <MagicLinkTabContent presenter={presenter} vm={vm} />
                        </Tabs.Panel>
                    </Tabs>
                </Stack>
            </Paper>
        </Center>
    );
});
