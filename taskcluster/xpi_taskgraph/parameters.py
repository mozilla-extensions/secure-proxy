# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import, print_function, unicode_literals

import os


def get_decision_parameters(graph_config, parameters):
    """Add repo-specific decision parameters.

    We don't have any repo-specific decision parameters, but we do need to
    set repositories' `ssh-secret-name` if they're private repos. This seemed
    to be the least objectionable place to add that.

    """
    for repo_prefix, repo_config in graph_config._config['taskgraph']['repositories'].items():
        env_var = "{}_SSH_SECRET_NAME".format(repo_prefix.upper())
        if os.environ.get(env_var):
            repo_config.setdefault('ssh-secret-name', os.environ[env_var])
