# -*- coding: utf-8 -*-

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import, print_function, unicode_literals

from copy import deepcopy
import json
import os
import pprint
import re
import time
from datetime import datetime

from taskgraph.config import load_graph_config
from taskgraph.util.schema import validate_schema
from taskgraph.util.vcs import calculate_head_rev, get_repo_path, get_repository_type
from taskgraph.util import yaml
from taskgraph.util.memoize import memoize
from taskgraph.util.readonlydict import ReadOnlyDict
from voluptuous import ALLOW_EXTRA, Optional, Required, Schema, Any


BASE_DIR = os.getcwd()
# Allowed characters in indexes, plus `:`, which we replace with a `-`
TEST_NAME_REGEX_STRING = r"""[^a-zA-Z0-9:_-]"""
TEST_NAME_REGEX = re.compile(TEST_NAME_REGEX_STRING)


def check_manifest(manifest_list):
    messages = []
    xpi_names = {}
    for manifest in manifest_list:
        xpi_names.setdefault(manifest["name"], []).append(
            manifest.get("directory", ".")
        )
        for test in manifest["tests"]:
            if TEST_NAME_REGEX.search(test):
                messages.append(
                    "Illegal test name in {}: {} !\nIllegal char regex: {}".format(
                        manifest["name"], test, TEST_NAME_REGEX_STRING
                    )
                )
    for k, v in xpi_names.items():
        if len(v) > 1:
            messages.append(
                "Duplicate xpi name {} in directories {}\nTry renaming your subdirectories".format(
                    k, v
                )
            )
    if messages:
        raise Exception(
            "Found the following issue with the package.json(s):\n{}".format(messages)
        )


@memoize
def get_manifest():
    manifest_list = []
    for dir_name, subdir_list, file_list in os.walk(BASE_DIR):
        for dir_ in subdir_list:
            if dir_ in (".git", "node_modules"):
                subdir_list.remove(dir_)
                continue
        if "package.json" in file_list:
            manifest = {"name": os.path.basename(dir_name), "tests": []}
            if "yarn.lock" in file_list:
                manifest["install-type"] = "yarn"
            elif "package-lock.json" in file_list:
                manifest["install-type"] = "npm"
            else:
                raise Exception(
                    "Missing yarn.lock or package-lock.json in {}!".format(dir_name)
                )
            if dir_name != BASE_DIR:
                manifest["directory"] = dir_name.replace("{}/".format(BASE_DIR), "")
            with open(os.path.join(dir_name, "package.json")) as fh:
                package_json = json.load(fh)
            for target in package_json.get("scripts", {}):
                if target.startswith("test") or target.startswith("lint"):
                    manifest["tests"].append(target)
            manifest_list.append(ReadOnlyDict(manifest))
    check_manifest(manifest_list[:])
    return tuple(manifest_list)


def get_xpi_config(xpi_name):
    manifest = get_manifest()
    xpi_configs = [xpi for xpi in manifest if xpi["name"] == xpi_name]
    if len(xpi_configs) != 1:
        raise Exception(
            "Unable to find a single xpi matching name {}: found {}".format(
                input.xpi_name, len(xpi_configs)
            )
        )
    return xpi_configs[0]
