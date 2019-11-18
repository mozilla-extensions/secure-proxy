# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""
Apply some defaults and minor modifications to the jobs defined in the build
kind.
"""

from __future__ import absolute_import, print_function, unicode_literals
from copy import deepcopy
import os

from taskgraph.transforms.base import TransformSequence
from xpi_taskgraph.xpi_manifest import get_manifest


transforms = TransformSequence()


@transforms.add
def tasks_from_manifest(config, jobs):
    manifest = get_manifest()
    for job in jobs:
        for xpi_config in manifest:
            task = deepcopy(job)
            env = task.setdefault("worker", {}).setdefault("env", {})
            run = task.setdefault("run", {})
            if "directory" in xpi_config:
                run["cwd"] = "{checkout}/%s" % xpi_config["directory"]
                extra = task.setdefault("extra", {})
                extra["directory"] = xpi_config["directory"]
            task["label"] = "build-{}".format(xpi_config["name"])
            env["XPI_NAME"] = xpi_config["name"]
            task.setdefault("extra", {})["xpi-name"] = xpi_config["name"]
            try:
                checkout_config["ssh_secret_name"] = config.graph_config[
                    "github_clone_secret"
                ]
                artifact_prefix = "xpi/build"
            except KeyError:
                artifact_prefix = "public/build"
            env["ARTIFACT_PREFIX"] = artifact_prefix
            artifacts = task["worker"].setdefault("artifacts", [])
            artifacts.append(
                {
                    "type": "directory",
                    "name": artifact_prefix,
                    "path": "/builds/worker/artifacts",
                }
            )
            if xpi_config.get("install-type"):
                env["XPI_INSTALL_TYPE"] = xpi_config["install-type"]

            yield task
