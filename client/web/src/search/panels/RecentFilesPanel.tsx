import React, { useCallback, useEffect, useMemo, useState } from 'react'

import classNames from 'classnames'
import FileCodeIcon from 'mdi-react/FileCodeIcon'
import { of } from 'rxjs'

import { gql } from '@sourcegraph/http-client'
import { SyntaxHighlightedSearchQuery } from '@sourcegraph/search-ui'
import { streamComputeQuery } from '@sourcegraph/shared/src/search/stream'
import { TelemetryProps } from '@sourcegraph/shared/src/telemetry/telemetryService'
import { Link, useObservable } from '@sourcegraph/wildcard'

import { authenticatedUser, AuthenticatedUser } from '../../auth'
import { RecentFilesFragment } from '../../graphql-operations'
import { useExperimentalFeatures } from '../../stores'
import { EventLogResult } from '../backend'

import { EmptyPanelContainer } from './EmptyPanelContainer'
import { HomePanelsFetchMore, RECENT_FILES_TO_LOAD } from './HomePanels'
import { LoadingPanelView } from './LoadingPanelView'
import { PanelContainer } from './PanelContainer'
import { ShowMoreButton } from './ShowMoreButton'

interface Props extends TelemetryProps {
    className?: string
    authenticatedUser: AuthenticatedUser | null
    recentFilesFragment: RecentFilesFragment | null
    fetchMore: HomePanelsFetchMore
}

export const recentFilesFragment = gql`
    fragment RecentFilesFragment on User {
        recentFilesLogs: eventLogs(first: $firstRecentFiles, eventName: "ViewBlob") {
            nodes {
                argument
                timestamp
                url
            }
            pageInfo {
                hasNextPage
            }
            totalCount
        }
    }
`

type ComputeParseResult = [{ kind: string; value: string }]

export const RecentFilesPanel: React.FunctionComponent<React.PropsWithChildren<Props>> = ({
    className,
    recentFilesFragment,
    telemetryService,
    fetchMore,
}) => {
    const [recentFiles, setRecentFiles] = useState<null | RecentFilesFragment['recentFilesLogs']>(
        recentFilesFragment?.recentFilesLogs ?? null
    )
    useEffect(() => setRecentFiles(recentFilesFragment?.recentFilesLogs ?? null), [
        recentFilesFragment?.recentFilesLogs,
    ])

    const [itemsToLoad, setItemsToLoad] = useState(RECENT_FILES_TO_LOAD)

    const [processedResults, setProcessedResults] = useState<RecentFile[] | null>(null)

    // Only update processed results when results are valid to prevent
    // flashing loading screen when "Show more" button is clicked
    useEffect(() => {
        if (recentFiles) {
            setProcessedResults(processRecentFiles(recentFiles))
        }
    }, [recentFiles])

    useEffect(() => {
        // Only log the first load (when items to load is equal to the page size)
        if (processedResults && itemsToLoad === RECENT_FILES_TO_LOAD) {
            telemetryService.log(
                'RecentFilesPanelLoaded',
                { empty: processedResults.length === 0 },
                { empty: processedResults.length === 0 }
            )
        }
    }, [processedResults, telemetryService, itemsToLoad])

    const logFileClicked = useCallback(() => telemetryService.log('RecentFilesPanelFileClicked'), [telemetryService])

    const loadingDisplay = <LoadingPanelView text="Loading recent files" />

    const emptyDisplay = (
        <EmptyPanelContainer className="align-items-center text-muted">
            <FileCodeIcon className="mb-2" size="2rem" />
            <small className="mb-2">This panel will display your most recently viewed files.</small>
        </EmptyPanelContainer>
    )

    async function loadMoreItems(): Promise<void> {
        telemetryService.log('RecentFilesPanelShowMoreClicked')
        const newItemsToLoad = itemsToLoad + RECENT_FILES_TO_LOAD
        setItemsToLoad(newItemsToLoad)

        const { data } = await fetchMore({
            firstRecentFiles: newItemsToLoad,
        })

        if (data === undefined) {

            return
        }
        const node = data.node
        if (node === null || node.__typename !== 'User') {
            return
        }
        setRecentFiles(node.recentFilesLogs)
    }

    const contentDisplay = (
        <div>
            <div className="mb-1 mt-2">
                <small>File</small>
            </div>
            {processedResults?.length && (
                <ul className="list-group-flush list-group mb-2">
                    {processedResults.map((recentFile, index) => (
                        <li key={index} className="text-monospace mb-2 d-block">
                            <small>
                                <Link to={recentFile.url} onClick={logFileClicked} data-testid="recent-files-item">
                                    {recentFile.repoName} › {recentFile.filePath}
                                </Link>
                            </small>
                        </li>
                    ))}
                </ul>
            )}
            {recentFiles?.pageInfo.hasNextPage && (
                <div>
                    <ShowMoreButton onClick={loadMoreItems} dataTestid="recent-files-panel-show-more" />
                </div>
            )}
        </div>
    )

        const checkHomePanelsFeatureFlag = useExperimentalFeatures(features => features.homePanelsComputeSuggestions)
        const gitRecentFiles = useObservable(
            useMemo(
                () =>
                    checkHomePanelsFeatureFlag && authenticatedUser
                        ? streamComputeQuery(
                              'type:diff author:akhalifae@conncoll.edu'
                          )
                        : of([]),
                [checkHomePanelsFeatureFlag]
            )
        )

        const gitSet = useMemo(() => {
            let gitRepositoryParsedString: ComputeParseResult[] = []
            if (gitRecentFiles) {
                gitRepositoryParsedString = gitRecentFiles.map(value => JSON.parse(value) as ComputeParseResult)
            }
            const gitReposList = gitRepositoryParsedString?.flat()

            const gitSet = new Set<string>()
            if (gitReposList) {
                for (const git of gitReposList) {
                    if (git.value) {
                        gitSet.add(git.value)
                    }
                }
            }

            return gitSet
        }, [gitRecentFiles])

        console.log(gitSet)

        const gitFilesDisplay = (
            <div className="mt-2">
                {gitSet.size > 0 && (
                    <ul className="list-group">
                        {Array.from(gitSet).map(file => (
                            <li key={`${file}`} className="text-monsospace text-break mb-2">
                                <small>
                                    <Link to={`/search?q=repo:${file}`} onClick={logFileClicked}>
                                        <SyntaxHighlightedSearchQuery query={`file:${file}`} />
                                    </Link>
                                </small>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        )
    return (
        <PanelContainer
            className={classNames(className, 'recent-files-panel')}
            title="Recent files"
            state={processedResults ? (processedResults.length > 0 ? 'populated' : 'empty') : 'loading'}
            loadingContent={loadingDisplay}
            // I switched these two displays because it was returning false
            populatedContent={gitSet.size > 0 ? contentDisplay : gitFilesDisplay}
            emptyContent={emptyDisplay}
        />
    )
}

interface RecentFile {
    repoName: string
    filePath: string
    timestamp: string
    url: string
}

function processRecentFiles(eventLogResult?: EventLogResult): RecentFile[] | null {
    if (!eventLogResult) {
        return null
    }

    const recentFiles: RecentFile[] = []

    for (const node of eventLogResult.nodes) {
        if (node.argument && node.url) {
            const parsedArguments = JSON.parse(node.argument)
            let repoName = parsedArguments?.repoName as string
            let filePath = parsedArguments?.filePath as string

            if (!repoName || !filePath) {
                ;({ repoName, filePath } = extractFileInfoFromUrl(node.url))
            }

            if (
                filePath &&
                repoName &&
                !recentFiles.some(file => file.repoName === repoName && file.filePath === filePath) // Don't show the same file twice
            ) {
                const parsedUrl = new URL(node.url)
                recentFiles.push({
                    url: parsedUrl.pathname + parsedUrl.search, // Strip domain from URL so clicking on it doesn't reload page
                    repoName,
                    filePath,
                    timestamp: node.timestamp,
                })
            }
        }
    }

    return recentFiles
}

function extractFileInfoFromUrl(url: string): { repoName: string; filePath: string } {
    const parsedUrl = new URL(url)

    // Remove first character as it's a '/'
    const [repoName, filePath] = parsedUrl.pathname.slice(1).split('/-/blob/')
    if (!repoName || !filePath) {
        return { repoName: '', filePath: '' }
    }

    return { repoName, filePath }
}
