import React from 'react'

import * as H from 'history'
import { Subscription } from 'rxjs'

import { PlatformContextProps } from '@sourcegraph/shared/src/platform/context'

interface Props extends PlatformContextProps {
    history: H.History
}

/**
 * A component that registers global contributions. It is implemented as a React component so that its
 * registrations use the React lifecycle.
 */
export class GlobalContributions extends React.Component<Props> {
    private subscriptions = new Subscription()

    public componentDidMount(): void {
        // Lazy-load `highlight/contributions.ts` to make main application bundle ~25kb Gzip smaller.
        import('@sourcegraph/common/src/util/markdown/contributions')
            .then(({ registerHighlightContributions }) => registerHighlightContributions()) // no way to unregister these
            .catch(error => {
                throw error // Throw error to the <ErrorBoundary />
            })
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    public render(): JSX.Element | null {
        return null
    }
}
