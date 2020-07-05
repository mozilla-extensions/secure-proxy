# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import, print_function, unicode_literals

import hashlib
import os
import subprocess

import taskgraph
from taskgraph.transforms.base import TransformSequence
from taskgraph.util.hash import hash_path

transforms = TransformSequence()

BASE_DIR = os.getcwd()

# Directory names we ignore, anywhere in the tree
# We won't recurse into these directories.
IGNORE_DIRS = (".git", "node_modules")

# File extensions we ignore, anywhere in the tree
IGNORE_EXTENSIONS = (".pyc", ".swp")

ADDITIONAL_FILES = (".taskcluster.yml", "eslintrc.js")


def list_files(path):
    files = []
    for dir_name, subdir_list, file_list in os.walk(path):
        for dir_ in subdir_list:
            if dir_ in IGNORE_DIRS:
                subdir_list.remove(dir_)
                continue
        for file_ in file_list:
            (_, ext) = os.path.splitext(file_)
            if ext in IGNORE_EXTENSIONS:
                continue
            files.append(
                os.path.relpath(os.path.join(BASE_DIR, dir_name, file_), BASE_DIR)
            )
    return set(files)


@transforms.add
def build_cache(config, tasks):
    repo_name = subprocess.check_output(["git", "remote", "get-url", "origin"]).rstrip()
    repo_name = repo_name.replace(".git", "").rstrip("/")
    repo_name = repo_name.split("/")[-1]

    for task in tasks:
        if task.get("cache", True) and not taskgraph.fast:
            digest_data = []
            directory = task.get("extra", {}).get("directory", BASE_DIR)
            directory = os.path.join(BASE_DIR, directory)
            files = list_files(directory)
            files.update(list_files(os.path.join(BASE_DIR, "taskcluster")))
            for path in ADDITIONAL_FILES:
                if os.path.exists(path):
                    files.update({path})
            h = hashlib.sha256()
            for path in sorted(list(files)):
                h.update(
                    "{} {}\n".format(
                        hash_path(os.path.realpath(os.path.join(BASE_DIR, path))), path
                    )
                )
            task.setdefault("attributes", {}).setdefault("cached_task", {})
            cache_name = task["label"].replace(":", "-")
            task["cache"] = {
                "type": "{}.v2".format(repo_name),
                "name": cache_name,
                "digest-data": [h.hexdigest()],
            }

        yield task
