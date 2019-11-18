# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""
Apply some defaults and minor modifications to the jobs defined in the build
kind.
"""

from __future__ import absolute_import, print_function, unicode_literals
from copy import deepcopy
import json
import os

from taskgraph.transforms.base import TransformSequence
from xpi_taskgraph.xpi_manifest import get_manifest


transforms = TransformSequence()

test_count = {}


@transforms.add
def test_tasks_from_manifest(config, jobs):
    manifest = get_manifest()
    for job in jobs:
        for xpi_config in manifest:
            xpi_name = xpi_config["name"]
            for target in sorted(xpi_config["tests"]):
                task = deepcopy(job)
                test_count.setdefault(xpi_name, 0)
                test_count[xpi_name] += 1
                task.setdefault("extra", {})["xpi-name"] = xpi_name
                env = task.setdefault("worker", {}).setdefault("env", {})
                run = task["run"]
                if "directory" in xpi_config:
                    run["cwd"] = "{checkout}/%s" % xpi_config["directory"]
                    extra = task.setdefault("extra", {})
                    extra["directory"] = xpi_config["directory"]
                else:
                    run["cwd"] = "{checkout}"
                run["command"] = run["command"].format(target=target)
                task["label"] = "t-{}-{}".format(target, xpi_name)
                try:
                    checkout_config["ssh_secret_name"] = config.graph_config[
                        "github_clone_secret"
                    ]
                    artifact_prefix = "xpi/build"
                except KeyError:
                    artifact_prefix = "public/build"
                env["ARTIFACT_PREFIX"] = artifact_prefix
                yield task
