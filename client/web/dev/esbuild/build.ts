import { writeFileSync } from 'fs'
import path from 'path'

import * as esbuild from 'esbuild'

import {
    MONACO_LANGUAGES_AND_FEATURES,
    ROOT_PATH,
    STATIC_ASSETS_PATH,
    stylePlugin,
    packageResolutionPlugin,
    workerPlugin,
    monacoPlugin,
    RXJS_RESOLUTIONS,
    buildMonaco,
    experimentalNoticePlugin,
    buildTimerPlugin,
} from '@sourcegraph/build-config'
import { isDefined } from '@sourcegraph/common'

import { ENVIRONMENT_CONFIG } from '../utils'

import { manifestPlugin } from './manifestPlugin'

const isEnterpriseBuild = ENVIRONMENT_CONFIG.ENTERPRISE
const useMonaco = !ENVIRONMENT_CONFIG.DEV_WEB_BUILDER_NO_MONACO

const DEV_WEB_BUILDER_ESBUILD_FORCE_TREESHAKING = Boolean(process.env.DEV_WEB_BUILDER_ESBUILD_FORCE_TREESHAKING)

export const BUILD_OPTIONS: esbuild.BuildOptions = {
    entryPoints: {
        // Enterprise vs. OSS builds use different entrypoints. The enterprise entrypoint imports a
        // strict superset of the OSS entrypoint.
        'scripts/app': isEnterpriseBuild
            ? path.join(ROOT_PATH, 'client/web/src/enterprise/main.tsx')
            : path.join(ROOT_PATH, 'client/web/src/main.tsx'),
    },
    bundle: true,
    format: 'esm',
    logLevel: 'error',
    jsx: 'automatic',
    jsxDev: true, // we're only using esbuild for dev server right now
    splitting: true,
    chunkNames: 'chunks/chunk-[name]-[hash]',
    outdir: STATIC_ASSETS_PATH,
    plugins: [
        stylePlugin,
        workerPlugin,
        manifestPlugin,
        packageResolutionPlugin({
            path: require.resolve('path-browserify'),
            ...RXJS_RESOLUTIONS,
            ...(useMonaco
                ? null
                : {
                      // Monaco
                      '@sourcegraph/shared/src/components/MonacoEditor':
                          '@sourcegraph/shared/src/components/NonMonacoEditor',
                      'monaco-editor': '/dev/null',
                      'monaco-editor/esm/vs/editor/editor.api': '/dev/null',
                      'monaco-yaml': '/dev/null',

                      // GraphiQL
                      './api/ApiConsole': path.join(ROOT_PATH, 'client/web/src/api/NoApiConsole.tsx'),
                      '@graphiql/react': '/dev/null',
                      graphiql: '/dev/null',

                      // Recharts
                      recharts: '/dev/null',

                      lodash: 'lodash-es',
                  }),
        }),
        useMonaco ? monacoPlugin(MONACO_LANGUAGES_AND_FEATURES) : null,
        buildTimerPlugin,
        experimentalNoticePlugin,
    ].filter(isDefined),
    define: {
        ...Object.fromEntries(
            Object.entries({ ...ENVIRONMENT_CONFIG, SOURCEGRAPH_API_URL: undefined }).map(([key, value]) => [
                `process.env.${key}`,
                JSON.stringify(value === undefined ? null : value),
            ])
        ),
        global: 'window',
    },
    loader: {
        '.yaml': 'text',
        '.ttf': 'file',
        '.png': 'file',
    },
    target: 'esnext',
    sourcemap: true,

    // TODO(sqs): When https://github.com/evanw/esbuild/pull/1458 is merged (or the issue is
    // otherwise fixed), we can return to using tree shaking. Right now, esbuild's tree shaking has
    // a bug where the NavBar CSS is not loaded because the @sourcegraph/wildcard uses `export *
    // from` and has `"sideEffects": false` in its package.json.
    ignoreAnnotations: !DEV_WEB_BUILDER_ESBUILD_FORCE_TREESHAKING,
    treeShaking: DEV_WEB_BUILDER_ESBUILD_FORCE_TREESHAKING,
}

export const build = async (): Promise<void> => {
    const metafile = process.env.ESBUILD_METAFILE
    const result = await esbuild.build({
        ...BUILD_OPTIONS,
        outdir: STATIC_ASSETS_PATH,
        metafile: Boolean(metafile),
    })
    if (metafile) {
        writeFileSync(metafile, JSON.stringify(result.metafile), 'utf-8')
    }
    if (useMonaco) {
        await buildMonaco(STATIC_ASSETS_PATH)
    }
}

if (require.main === module) {
    build()
        .catch(error => console.error('Error:', error))
        .finally(() => process.exit(0))
}
