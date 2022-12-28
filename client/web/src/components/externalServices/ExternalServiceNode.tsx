import React, { useCallback, useState } from 'react'

import { mdiCircle, mdiCog, mdiConnection, mdiDelete } from '@mdi/js'
import classNames from 'classnames'
import * as H from 'history'

import { Timestamp } from '@sourcegraph/branded/src/components/Timestamp'
import { asError, isErrorLike, pluralize } from '@sourcegraph/common'
import { Button, Link, LoadingSpinner, Icon, Tooltip, Text, ErrorAlert } from '@sourcegraph/wildcard'

import { ListExternalServiceFields } from '../../graphql-operations'
import { refreshSiteFlags } from '../../site/backend'

import { deleteExternalService, useExternalServiceCheckConnectionByIdLazyQuery } from './backend'
import { defaultExternalServices } from './externalServices'

import styles from './ExternalServiceNode.module.scss'


export interface ExternalServiceNodeProps {
    node: ListExternalServiceFields
    onDidUpdate: () => void
    history: H.History
    routingPrefix: string
    afterDeleteRoute: string
    editingDisabled: boolean
}

export const ExternalServiceNode: React.FunctionComponent<React.PropsWithChildren<ExternalServiceNodeProps>> = ({
    node,
    onDidUpdate,
    history,
    routingPrefix,
    afterDeleteRoute,
    editingDisabled,
}) => {
    const [isDeleting, setIsDeleting] = useState<boolean | Error>(false)
    const onDelete = useCallback<React.MouseEventHandler>(async () => {
        if (!window.confirm(`Delete the external service ${node.displayName}?`)) {
            return
        }
        setIsDeleting(true)
        try {
            await deleteExternalService(node.id)
            setIsDeleting(false)
            onDidUpdate()
            // eslint-disable-next-line rxjs/no-ignored-subscription
            refreshSiteFlags().subscribe()
            history.push(afterDeleteRoute)
        } catch (error) {
            setIsDeleting(asError(error))
        }
    }, [afterDeleteRoute, history, node.displayName, node.id, onDidUpdate])

    const [doCheckConnection, {called: checkConnectionCalled, loading: checkConnectionLoading, data: checkConnectionData}] = useExternalServiceCheckConnectionByIdLazyQuery(node.id)

    // const [isTestInProgress, setIsTestInProgress] = useState<boolean | Error>(false)
    const onTestConnection = useCallback<React.MouseEventHandler>(async () => {
        try {
            await doCheckConnection()
        } catch (error) {

        }
    }, [])

    const capitalizeSuspectedReason = (s: string) => {
      const firstCharacter = s.charAt(0).toUpperCase();
      const restOfString = s.slice(1);
      return firstCharacter + restOfString;
    };

    const IconComponent = defaultExternalServices[node.kind].icon

    return (
        <li
            className={classNames(styles.listNode, 'external-service-node list-group-item')}
            data-test-external-service-name={node.displayName}
        >
            <div className="d-flex align-items-center justify-content-between">
                <div className="align-self-start">
                    {node.lastSyncError === null && (
                        <Tooltip content="All good, no errors!">
                            <Icon
                                svgPath={mdiCircle}
                                aria-label="Code host integration is healthy"
                                className="text-success mr-2"
                            />
                        </Tooltip>
                    )}
                    {node.lastSyncError !== null && (
                        <Tooltip content="Syncing failed, check the error message for details!">
                            <Icon
                                svgPath={mdiCircle}
                                aria-label="Code host integration is unhealthy"
                                className="text-danger mr-2"
                            />
                        </Tooltip>
                    )}
                </div>
                <div className="flex-grow-1">
                    <div>
                        <Icon as={IconComponent} aria-label="Code host logo" className="mr-2" />
                        <strong>
                            {node.displayName}{' '}
                            <small className="text-muted">
                                ({node.repoCount} {pluralize('repository', node.repoCount, 'repositories')})
                            </small>
                        </strong>
                        <br />
                        <Text className="mb-0 text-muted">
                            <small>
                                {node.lastSyncAt === null ? (
                                    <>Never synced.</>
                                ) : (
                                    <>
                                        Last synced <Timestamp date={node.lastSyncAt} />.
                                    </>
                                )}{' '}
                                {node.nextSyncAt !== null && (
                                    <>
                                        Next sync scheduled <Timestamp date={node.nextSyncAt} />.
                                    </>
                                )}
                                {node.nextSyncAt === null && <>No next sync scheduled.</>}
                                <br />
            {!checkConnectionLoading && checkConnectionCalled && checkConnectionData &&
                checkConnectionData.node?.checkConnection?.__typename === 'ExternalServiceAvailable' &&
                checkConnectionData.node.checkConnection.lastCheckedAt &&
                <>
                <span className="text-success">Code host is available. Last checked <Timestamp date={checkConnectionData.node.checkConnection.lastCheckedAt} />.
                </span>
                </>
            }

            {!checkConnectionLoading && checkConnectionCalled && checkConnectionData &&
                checkConnectionData.node?.checkConnection?.__typename === 'ExternalServiceUnavailable' &&
                checkConnectionData.node.checkConnection.suspectedReason &&
                <>
                <span className="text-danger">
                {capitalizeSuspectedReason(checkConnectionData.node.checkConnection.suspectedReason)}
                </span>
                </>
            }
                           </small>
                        </Text>
                    </div>
                </div>
                <div className="flex-shrink-0 ml-3">
                    <Tooltip content={node?.hasConnectionCheck? "Test code host connection" : "Connection check unavailable" }>
                        <Button
                            className="test-connection-external-service-button"
                            variant="secondary"
                            onClick={onTestConnection}
                            disabled={!node?.hasConnectionCheck || checkConnectionLoading}
                            size="sm"
                        >
                        {checkConnectionLoading && <><LoadingSpinner /> Checking</>}
                        {!checkConnectionLoading && <><Icon aria-hidden={true} svgPath={mdiConnection} /> Test</>}
                        </Button>
                    </Tooltip>{' '}
                    <Tooltip content={`${editingDisabled ? 'View' : 'Edit'} code host connection settings`}>
                        <Button
                            className="test-edit-external-service-button"
                            to={`${routingPrefix}/external-services/${node.id}`}
                            variant="secondary"
                            size="sm"
                            as={Link}
                        >
                            <Icon aria-hidden={true} svgPath={mdiCog} /> {editingDisabled ? 'View' : 'Edit'}
                        </Button>
                    </Tooltip>{' '}
                    <Tooltip content="Delete code host connection">
                        <Button
                            aria-label="Delete"
                            className="test-delete-external-service-button"
                            onClick={onDelete}
                            disabled={isDeleting === true}
                            variant="danger"
                            size="sm"
                        >
                            <Icon aria-hidden={true} svgPath={mdiDelete} />
                        </Button>
                    </Tooltip>
                </div>
            </div>
            {node.lastSyncError !== null && (
                <ErrorAlert error={node.lastSyncError} variant="danger" className="mt-2 mb-0" />
            )}
            {isErrorLike(isDeleting) && <ErrorAlert className="mt-2" error={isDeleting} />}
        </li>
    )
}
