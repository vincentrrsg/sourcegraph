import { useLocalStorage } from '@sourcegraph/wildcard'
import * as H from 'history'
import { useEffect, useRef } from 'react'

export interface UserHistoryEntry {
    url: string
    lastAccessed: number
}
const MAX_HISTORY_LENGTH = 100
export function useUserHistory(history: H.History): UserHistoryEntry[] {
    const [entries, setEntries] = useLocalStorage<UserHistoryEntry[]>('user-history', [])
    const entriesRef = useRef(entries)
    entriesRef.current = entries
    useEffect(() => {
        const unregister = history.listen(entry => {
            const url = entry.pathname
            if (entriesRef.current.length > 0 && entriesRef.current[0].url === url) {
                // The latest URL is the same as this URL.
                return
            }
            const newEntries: UserHistoryEntry[] = [
                { url, lastAccessed: Date.now() },
                ...entriesRef.current.filter(entry => entry.url !== url).slice(0, MAX_HISTORY_LENGTH - 1),
            ]
            setEntries(newEntries)
        })
        return () => unregister()
    }, [])
    return entries
}
