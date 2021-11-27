import classNames from 'classnames'
import React, { useRef, useState } from 'react'

import { Resizable } from '@sourcegraph/shared/src/components/Resizable'
import { Button } from '@sourcegraph/wildcard'

import { Badge } from '../../../../../../components/Badge'
import { FeedbackPromptContent } from '../../../../../../nav/Feedback/FeedbackPrompt'
import { Popover } from '../../../../../insights/components/popover/Popover'
import { CatalogComponentFiltersProps } from '../../../../core/component-filters'
import { ComponentList } from '../component-list/ComponentList'

import styles from './Sidebar.module.scss'

const SIZE_STORAGE_KEY = 'catalog-sidebar-size'

interface SidebarProps extends CatalogComponentFiltersProps {}

export const Sidebar: React.FunctionComponent<SidebarProps> = props => (
    <Resizable
        defaultSize={200}
        handlePosition="right"
        storageKey={SIZE_STORAGE_KEY}
        className={styles.resizable}
        element={<SidebarContent className="border-right w-100" {...props} />}
    />
)

const SidebarContent: React.FunctionComponent<SidebarProps & { className?: string }> = ({
    filters,
    onFiltersChange,
    className,
}) => (
    <div className={classNames('p-2 d-flex flex-column', className)}>
        <h2 className="h5 font-weight-bold">Catalog</h2>
        <ComponentList filters={filters} onFiltersChange={onFiltersChange} className="flex-1" />
        <div className="flex-1" />
        <FeedbackPopoverButton />
    </div>
)

const FeedbackPopoverButton: React.FunctionComponent = () => {
    const buttonReference = useRef<HTMLButtonElement>(null)
    const [isVisible, setVisibility] = useState(false)

    return (
        <div className="d-flex align-items-center">
            <Badge status="wip" className="text-uppercase mr-2" />
            <Button ref={buttonReference} variant="link" size="sm">
                Share feedback
            </Button>
            <Popover
                isOpen={isVisible}
                target={buttonReference}
                onVisibilityChange={setVisibility}
                className={styles.feedbackPrompt}
            >
                <FeedbackPromptContent
                    closePrompt={() => setVisibility(false)}
                    textPrefix="Code Insights: "
                    routeMatch="/insights/dashboards"
                />
            </Popover>
        </div>
    )
}
