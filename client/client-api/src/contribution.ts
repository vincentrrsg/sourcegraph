export interface ActionContribution {
    id: string
    command?: string
    commandArguments?: (string | number | boolean | null | object[])[]
    title?: string
    disabledTitle?: string
    description?: string
    actionItem?: ActionItem
}

export interface ActionItem {
    label?: string
    description?: string
    iconURL?: string
    iconDescription?: string
    pressed?: boolean
}
