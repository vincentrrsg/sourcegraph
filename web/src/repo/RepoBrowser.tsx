import GearIcon from '@sourcegraph/icons/lib/Gear'
import * as React from 'react'
import { Link, RouteComponentProps } from 'react-router-dom'
import { FilteredConnection } from '../components/FilteredConnection'
import { PageTitle } from '../components/PageTitle'
import { fetchAllRepositories } from '../site-admin/backend'
import { eventLogger } from '../tracking/eventLogger'

export const RepositoryNode: React.SFC<{ node: GQL.IRepository }> = ({ node: repo }) => (
    <li key={repo.id} className="site-admin-detail-list__item site-admin-repositories-page__repo">
        <div className="site-admin-detail-list__header site-admin-repositories-page__repo-header">
            <Link to={`/${repo.uri}`} className="site-admin-detail-list__name">
                {repo.uri}
            </Link>
        </div>
    </li>
)

interface Props extends RouteComponentProps<any> {
    user: GQL.IUser | null
}

export class RepoBrowser extends React.PureComponent<Props> {
    public componentDidMount(): void {
        eventLogger.logViewEvent('Browse')
    }

    public render(): JSX.Element | null {
        return (
            <div className="repo-browser">
                <PageTitle title="Repositories" />
                <h2>Repositories</h2>
                {this.props.user &&
                    this.props.user.siteAdmin && (
                        <div className="repo-browser__actions">
                            <Link
                                to="/site-admin/configuration"
                                className="btn btn-primary btn-sm site-admin-page__actions-btn"
                            >
                                <GearIcon className="icon-inline" /> Configure repositories
                            </Link>
                            (site admin only)
                        </div>
                    )}
                <FilteredConnection
                    className="repo-browser__filtered-connection"
                    noun="repository"
                    pluralNoun="repositories"
                    queryConnection={this.queryRepositories}
                    nodeComponent={RepositoryNode}
                    history={this.props.history}
                    location={this.props.location}
                />
            </div>
        )
    }

    private queryRepositories = (query: string) => fetchAllRepositories({ query })
}
