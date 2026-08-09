import type React from "react";
import { useState } from "react";
import { AppShell, MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";
import { ContainerProvider } from "#ui/infrastructure/Shared/di/ContainerProvider.js";
import { PreAuthLifecycle, PostAuthLifecycle } from "./AppLifecycle.js";
import { AppHeader, AuthGate, SbomDialogContainer } from "./AppHeader.js";
import { PresentationFeature } from "./presentation/feature.js";
import { RouterComponent } from "./infrastructure/Router/index.js";

const ALL_FEATURES = [PresentationFeature];

export function App(): React.ReactNode {
    const [sbomDialogOpened, setSbomDialogOpened] = useState(false);

    return (
        <ContainerProvider features={ALL_FEATURES}>
            <PreAuthLifecycle />
            <MantineProvider>
                <Notifications position="bottom-left" />
                <AuthGate>
                    <PostAuthLifecycle />
                    <AppShell header={{ height: 60 }} padding="md">
                        <AppHeader onSbomExportClick={() => setSbomDialogOpened(true)} />
                        <AppShell.Main>
                            <RouterComponent />
                        </AppShell.Main>
                    </AppShell>
                    <SbomDialogContainer
                        opened={sbomDialogOpened}
                        onClose={() => setSbomDialogOpened(false)}
                    />
                </AuthGate>
            </MantineProvider>
        </ContainerProvider>
    );
}
