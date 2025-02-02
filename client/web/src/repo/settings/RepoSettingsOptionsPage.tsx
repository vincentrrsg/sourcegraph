import * as React from 'react'

import { RouteComponentProps } from 'react-router'
import { Subject, Subscription } from 'rxjs'
import { switchMap } from 'rxjs/operators'

import { asError } from '@sourcegraph/common'
import { Container, PageHeader, LoadingSpinner, Text, ErrorAlert, H2 } from '@sourcegraph/wildcard'

import { CopyableText } from '../../components/CopyableText'
import { ExternalServiceCard } from '../../components/externalServices/ExternalServiceCard'
import { defaultExternalServices } from '../../components/externalServices/externalServices'
import { PageTitle } from '../../components/PageTitle'
import { SettingsAreaRepositoryFields } from '../../graphql-operations'
import { eventLogger } from '../../tracking/eventLogger'

import { fetchSettingsAreaRepository } from './backend'

interface Props extends RouteComponentProps<{}> {
    repo: SettingsAreaRepositoryFields
}

interface State {
    /**
     * The repository object, refreshed after we make changes that modify it.
     */
    repo: SettingsAreaRepositoryFields

    loading: boolean
    error?: string
}

/**
 * The repository settings options page.
 */
export class RepoSettingsOptionsPage extends React.PureComponent<Props, State> {
    private repoUpdates = new Subject<void>()
    private subscriptions = new Subscription()

    constructor(props: Props) {
        super(props)

        this.state = {
            loading: false,
            repo: props.repo,
        }
    }

    public componentDidMount(): void {
        eventLogger.logViewEvent('RepoSettings')

        this.subscriptions.add(
            this.repoUpdates.pipe(switchMap(() => fetchSettingsAreaRepository(this.props.repo.name))).subscribe(
                repo => this.setState({ repo }),
                error => this.setState({ error: asError(error).message })
            )
        )
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    public render(): JSX.Element | null {
        const services = this.state.repo.externalServices.nodes
        return (
            <>
                <PageTitle title="Repository settings" />
                <PageHeader path={[{ text: 'Settings' }]} headingElement="h2" className="mb-3" />
                <Container className="repo-settings-options-page">
                    <H2 className="mb-3">Code hosts</H2>
                    {this.state.loading && <LoadingSpinner />}
                    {this.state.error && <ErrorAlert error={this.state.error} />}
                    {services.length > 0 && (
                        <div className="mb-3">
                            {services.map(service => (
                                <div className="mb-3" key={service.id}>
                                    <ExternalServiceCard
                                        {...defaultExternalServices[service.kind]}
                                        kind={service.kind}
                                        title={service.displayName}
                                        shortDescription="Update this external service configuration to manage repository mirroring."
                                        to={`/site-admin/external-services/${service.id}`}
                                        toIcon={null}
                                        bordered={false}
                                    />
                                </div>
                            ))}
                            {services.length > 1 && (
                                <Text>
                                    This repository is mirrored by multiple external services. To change access,
                                    disable, or remove this repository, the configuration must be updated on all
                                    external services.
                                </Text>
                            )}
                        </div>
                    )}
                    <H2 className="mb-3">Repository name</H2>
                    <CopyableText text={this.state.repo.name} size={this.state.repo.name.length} />
                </Container>
            </>
        )
    }
}
