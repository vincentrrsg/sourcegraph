import * as H from 'history'
import { Renderer } from 'react-dom'

import { createController as createExtensionsController } from '@sourcegraph/shared/src/extensions/createSyncLoadedController'
import { PlatformContextProps } from '@sourcegraph/shared/src/platform/context'

import { GlobalDebug } from '../../components/GlobalDebug'
import { createPlatformContext, SourcegraphIntegrationURLs, BrowserPlatformContext } from '../../platform/context'

import { CodeHost } from './codeHost'

/**
 * Initializes extensions for a page. It creates the {@link PlatformContext} and extensions controller.
 *
 */
export function initializeExtensions(
    { urlToFile }: Pick<CodeHost, 'urlToFile'>,
    urls: SourcegraphIntegrationURLs,
    isExtension: boolean
): { platformContext: BrowserPlatformContext } {
    const platformContext = createPlatformContext({ urlToFile }, urls, isExtension)
    const extensionsController = createExtensionsController(platformContext)
    return { platformContext, extensionsController }
}

interface InjectProps
    extends PlatformContextProps<'settings' | 'sideloadedExtensionURL' | 'sourcegraphURL'>,
        RequiredExtensionsControllerProps {
    history: H.History
    render: Renderer
}

export const renderGlobalDebug =
    ({
        platformContext,
        history,
        render,
        sourcegraphURL,
    }: InjectProps & { sourcegraphURL: string; showGlobalDebug?: boolean }) =>
    (mount: HTMLElement): void => {
        render(
            <GlobalDebug
                location={history.location}
                platformContext={platformContext}
                sourcegraphURL={sourcegraphURL}
            />,
            mount
        )
    }
