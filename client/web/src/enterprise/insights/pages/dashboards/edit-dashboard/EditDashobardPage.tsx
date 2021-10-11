import classnames from 'classnames'
import { camelCase } from 'lodash';
import MapSearchIcon from 'mdi-react/MapSearchIcon'
import React, { useContext, useMemo } from 'react'
import { useHistory } from 'react-router'
import { Link } from 'react-router-dom'

import { asError } from '@sourcegraph/shared/src/util/errors';
import { useObservable } from '@sourcegraph/shared/src/util/useObservable'
import { Button, Container, LoadingSpinner, PageHeader } from '@sourcegraph/wildcard'

import { AuthenticatedUser } from '../../../../../auth'
import { HeroPage } from '../../../../../components/HeroPage'
import { LoaderButton } from '../../../../../components/LoaderButton'
import { Page } from '../../../../../components/Page'
import { PageTitle } from '../../../../../components/PageTitle'
import { CodeInsightsIcon } from '../../../components'
import { FORM_ERROR } from '../../../components/form/hooks/useForm';
import { InsightsApiContext } from '../../../core/backend/api-provider'
import {
    DashboardCreationFields,
    InsightsDashboardCreationContent
} from '../creation/components/insights-dashboard-creation-content/InsightsDashboardCreationContent'

import styles from './EditDashboardPage.module.scss'

interface EditDashboardPageProps {
    dashboardId: string
    authenticatedUser: Pick<AuthenticatedUser, 'id' | 'organizations' | 'username'>
}

/**
 * Displays the edit (configure) dashboard page.
 */
export const EditDashboardPage: React.FunctionComponent<EditDashboardPageProps> = props => {
    const { dashboardId, authenticatedUser } = props

    const history = useHistory()
    const { getDashboard, getInsightSubjects, updateDashboard } = useContext(InsightsApiContext)

    // Load edit dashboard information
    const subjects = useObservable(useMemo(() => getInsightSubjects(), [getInsightSubjects]))
    const dashboard = useObservable(useMemo(() => getDashboard(dashboardId), [getDashboard, dashboardId]))

    // Loading state
    if (!subjects || dashboard === undefined) {
        return <LoadingSpinner />
    }

    // In case if we got null that means we couldn't find this dashboard
    if (dashboard === null) {
        return (
            <HeroPage
                icon={MapSearchIcon}
                title="Oops, we couldn't find the dashboard"
                subtitle={
                    <span>
                        We couldn't find that dashboard. Try to find the dashboard with ID:{' '}
                        <code className="badge badge-secondary">{dashboardId}</code> in your{' '}
                        <Link to={`/users/${authenticatedUser?.username}/settings`}>user or org settings</Link>
                    </span>
                }
            />
        )
    }

    // Convert dashboard info to initial form values
    const dashboardInitialValues = dashboard
        ? { name: dashboard.title, visibility: dashboard.owner.id }
        : undefined

    const handleSubmit = async (dashboardValues: DashboardCreationFields): Promise<void| unknown> => {
        if (!dashboard) {
            return
        }

        try {
            await updateDashboard({
                previousDashboard: dashboard,
                nextDashboardInput: dashboardValues
            }).toPromise()

            history.push(`/insights/dashboards/${camelCase(dashboardValues.name.trim())}`)
        } catch (error) {
            return { [FORM_ERROR]: asError(error) }
        }

        return
    }
    const handleCancel = (): void => history.goBack()

    return (
        <Page className={classnames('col-8', styles.page)}>
            <PageTitle title="Configure dashboard" />

            <PageHeader path={[{ icon: CodeInsightsIcon }, { text: 'Configure dashboard' }]} />

            <span className="text-muted d-block mt-2">
                Dashboards group your insights and let you share them with others.{' '}
                <a
                    href="https://docs.sourcegraph.com/code_insights/explanations/viewing_code_insights"
                    target="_blank"
                    rel="noopener"
                >
                    Learn more.
                </a>
            </span>

            <Container className="mt-4">
                <InsightsDashboardCreationContent
                    initialValues={dashboardInitialValues}
                    subjects={subjects}
                    onSubmit={handleSubmit}
                >
                    {formAPI => (
                        <>
                            <Button
                                type="button"
                                variant="secondary"
                                outline={true}
                                className="mb-2"
                                onClick={handleCancel}
                            >
                                Cancel
                            </Button>

                            <LoaderButton
                                alwaysShowLabel={true}
                                data-testid="insight-save-button"
                                loading={formAPI.submitting}
                                label={formAPI.submitting ? 'Saving' : 'Save changes'}
                                type="submit"
                                disabled={formAPI.submitting}
                                className="btn btn-primary ml-2 mb-2"
                            />
                        </>
                    )}
                </InsightsDashboardCreationContent>
            </Container>
        </Page>
    )
}
