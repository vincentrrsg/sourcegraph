import React from 'react'

import { Code, Text } from '@sourcegraph/wildcard'

export const MonacoEditor: React.FunctionComponent = () => (
    <Text className="border border-danger p-2">
        Monaco editor is not included in this bundle because the environment variable{' '}
        <Code>DEV_WEB_BUILDER_NO_MONACO</Code> is set.
    </Text>
)
