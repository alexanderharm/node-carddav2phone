#!/bin/bash

args=( "$@" )

# check if node is available
if which node > /dev/null; then
	node="$(which node)"
else
	echo "node not found. Please install a working version of node."
	exit 1
fi

# check if npm is available
if which npm > /dev/null; then
	npm="$(which npm)"
else
	echo "npm not found. Please install a working version of npm."
	npm=""
	exit 1
fi

# check if git is available
if which git > /dev/null; then
	git="$(which git)"
else
	echo "Git not found. Please install a working version of git."
	echo "Synology: \"Git Server\" (official), SynoCommunity's \"git\" or Entware-ng's."
	git=""
fi

# change dir
cd "$(dirname "$0")" || exit 1

# self update and install dependencies
$git pull --force
$npm ci

# run node app
$node dist/index.js "${args[@]}"

# exit
exit 0