import { FC, useContext } from 'react'

import { useHistory } from 'react-router'

import { TelemetryProps } from '@sourcegraph/shared/src/telemetry/telemetryService'

import { useExperimentalFeatures } from '../../../../../stores'
import { CodeInsightsBackendContext, CreationInsightInput } from '../../../core'
import { useQueryParameters } from '../../../hooks'

import { CaptureGroupCreationPage } from './capture-group'
import { ComputeInsightCreationPage } from './compute'
import { LangStatsInsightCreationPage } from './lang-stats'
import { SearchInsightCreationPage } from './search-insight'

export enum InsightCreationPageType {
    LangStats = 'lang-stats',
    Compute = 'compute',
    Search = 'search-based',
    CaptureGroup = 'capture-group',
}

interface InsightCreateEvent {
    insight: CreationInsightInput
}

interface InsightCreationPageProps extends TelemetryProps {
    mode: InsightCreationPageType
}

export const InsightCreationPage: FC<InsightCreationPageProps> = props => {
    const { mode, telemetryService } = props

    const history = useHistory()
    const { createInsight } = useContext(CodeInsightsBackendContext)
    const { dashboardId = null } = useQueryParameters(['dashboardId'])

    const { codeInsightsCompute } = useExperimentalFeatures()

    const handleInsightCreateRequest = async (event: InsightCreateEvent): Promise<unknown> => {
        const { insight } = event

        return createInsight({ insight, dashboardId }).toPromise()
    }

    const handleInsightSuccessfulCreation = (): void => {
        if (!dashboardId) {
            // Navigate to the dashboard page with new created dashboard
            history.push('/insights/all')

            return
        }

        history.push(`/insights/dashboards/${dashboardId}`)
    }

    const handleCancel = (): void => {
        if (!dashboardId) {
            history.push('/insights/all')

            return
        }

        history.push(`/insights/dashboards/${dashboardId}`)
    }

    if (mode === InsightCreationPageType.CaptureGroup) {
        return (
            <CaptureGroupCreationPage
                telemetryService={telemetryService}
                onInsightCreateRequest={handleInsightCreateRequest}
                onSuccessfulCreation={handleInsightSuccessfulCreation}
                onCancel={handleCancel}
            />
        )
    }

    if (mode === InsightCreationPageType.Search) {
        return (
            <SearchInsightCreationPage
                telemetryService={telemetryService}
                onInsightCreateRequest={handleInsightCreateRequest}
                onSuccessfulCreation={handleInsightSuccessfulCreation}
                onCancel={handleCancel}
            />
        )
    }

    if (codeInsightsCompute && mode === InsightCreationPageType.Compute) {
        return (
            <ComputeInsightCreationPage
                telemetryService={telemetryService}
                onInsightCreateRequest={handleInsightCreateRequest}
                onSuccessfulCreation={handleInsightSuccessfulCreation}
                onCancel={handleCancel}
            />
        )
    }

    return (
        <LangStatsInsightCreationPage
            telemetryService={telemetryService}
            onInsightCreateRequest={handleInsightCreateRequest}
            onSuccessfulCreation={handleInsightSuccessfulCreation}
            onCancel={handleCancel}
        />
    )
}
