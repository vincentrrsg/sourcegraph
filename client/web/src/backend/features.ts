import { Observable, from, concat } from 'rxjs'
import { switchMap } from 'rxjs/operators'

import { HoverMerged } from '@sourcegraph/client-api'
import { MaybeLoadingResult } from '@sourcegraph/codeintellify'
import {
    FileSpec,
    UIPositionSpec,
    RepoSpec,
    ResolvedRevisionSpec,
    toURIWithPath,
} from '@sourcegraph/shared/src/util/url'

/**
 * Fetches hover information for the given location.
 *
 * @param context the location
 * @returns hover for the location
 */
export function getHover(
    context: RepoSpec & ResolvedRevisionSpec & FileSpec & UIPositionSpec,
    { extensionsController }: ExtensionsControllerProps<'extHostAPI'>
): Observable<MaybeLoadingResult<HoverMerged | null>> {
    return concat(
        [{ isLoading: true, result: null }],
        extensionsController !== null
            ? from(extensionsController.extHostAPI).pipe(
                  switchMap(extensionHost =>
                      wrapRemoteObservable(
                          extensionHost.getHover({
                              textDocument: {
                                  uri: toURIWithPath(context),
                              },
                              position: {
                                  character: context.position.character - 1,
                                  line: context.position.line - 1,
                              },
                          })
                      )
                  )
              )
            : [{ isLoading: false, result: null }]
    )
}

/**
 * Fetches document highlight information for the given location.
 *
 * @param context the location
 * @returns document highlights for the location
 */
export function getDocumentHighlights(
    context: RepoSpec & ResolvedRevisionSpec & FileSpec & UIPositionSpec,
    { extensionsController }: ExtensionsControllerProps<'extHostAPI'>
): Observable<DocumentHighlight[]> {
    return concat(
        [[]],
        extensionsController !== null
            ? from(extensionsController.extHostAPI).pipe(
                  switchMap(extensionHost =>
                      wrapRemoteObservable(
                          extensionHost.getDocumentHighlights({
                              textDocument: {
                                  uri: toURIWithPath(context),
                              },
                              position: {
                                  character: context.position.character - 1,
                                  line: context.position.line - 1,
                              },
                          })
                      )
                  )
              )
            : [[]]
    )
}
