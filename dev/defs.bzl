load("@aspect_rules_js//npm:defs.bzl", _npm_package = "npm_package")
load("@aspect_rules_ts//ts:defs.bzl", _ts_project = "ts_project")
load("@aspect_bazel_lib//lib:copy_to_bin.bzl", "copy_to_bin")
load("@npm//:sass/package_json.bzl", sass_bin = "bin")

def ts_project(name, deps = [], **kwargs):
    deps = deps + [
        "//:node_modules/tslib",
    ]

    testonly = kwargs.pop("testonly", False)

    # Add standard test libraries for the repo test frameworks
    if testonly:
        deps = deps + ["//:node_modules/@types/jest"]

    """Default arguments for ts_project."""
    _ts_project(
        name = name,
        deps = deps,

        # tsconfig options
        tsconfig = "//:tsconfig",
        composite = True,
        declaration = True,
        declaration_map = True,
        resolve_json_module = True,
        source_map = True,

        # Rule options
        visibility = kwargs.pop("visibility", ["//visibility:public"]),
        testonly = testonly,
        supports_workers = False,

        # Allow any other args
        **kwargs
    )

def npm_package(name, **kwargs):
    _npm_package(
        name = name,

        # Default visiblity
        visibility = kwargs.pop("visibility", ["//visibility:public"]),

        # Allow any other args
        **kwargs
    )

def sass(name, srcs, deps = [], **kwargs):
    sass_bin.sass(
        name = name,
        srcs = srcs + deps,
        outs = [src.replace(".scss", ".css") for src in srcs],
        args = [
            "--load-path=client",
            "--load-path=node_modules",
        ] + [
            "$(execpath {}):{}/{}".format(src, native.package_name(), src.replace(".scss", ".css"))
            for src in srcs
        ],

        # Default visiblity
        visibility = kwargs.pop("visibility", ["//visibility:public"]),

        # Allow any other args
        **kwargs
    )

def sass_library(name, srcs, **kwargs):
    copy_to_bin(
        name = name,
        srcs = srcs,
        **kwargs
    )
