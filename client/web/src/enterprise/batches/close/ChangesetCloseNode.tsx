import React from 'react'

import * as H from 'history'

import { ChangesetFields } from '../../../graphql-operations'
import { queryExternalChangesetWithFileDiffs } from '../detail/backend'

import { ExternalChangesetCloseNode } from './ExternalChangesetCloseNode'
import { HiddenExternalChangesetCloseNode } from './HiddenExternalChangesetCloseNode'

import styles from './ChangesetCloseNode.module.scss'

export interface ChangesetCloseNodeProps {
    node: ChangesetFields
    viewerCanAdminister: boolean
    history: H.History
    location: H.Location
    queryExternalChangesetWithFileDiffs?: typeof queryExternalChangesetWithFileDiffs
    willClose: boolean
}

export const ChangesetCloseNode: React.FunctionComponent<React.PropsWithChildren<ChangesetCloseNodeProps>> = ({
    node,
    ...props
}) => (
    <li className={styles.changesetCloseNode}>
        <span className={styles.changesetCloseNodeSeparator} />
        {node.__typename === 'ExternalChangeset' ? (
            <ExternalChangesetCloseNode node={node} {...props} />
        ) : (
            <HiddenExternalChangesetCloseNode node={node} {...props} />
        )}
    </li>
)
