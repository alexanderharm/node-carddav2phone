#!/bin/bash

# check if run as root
if [ $(id -u "$(whoami)") -ne 0 ]; then
	echo "CardDAV2Phone needs to run as root!"
	exit 1
fi

# check if node is available
if command -v /usr/bin/node > /dev/null; then
	node="/usr/bin/node"
elif command -v /usr/local/bin/node > /dev/null; then
	node="/usr/local/bin/node"
elif command -v /opt/bin/node > /dev/null; then
	node="/opt/bin/node"
elif which node > /dev/null; then
	node="$(which node)"
else
	echo "node not found. Please install a working version of node."
	exit 1
fi

# check if npm is available
if command -v /usr/bin/npm > /dev/null; then
	npm="/usr/bin/npm"
elif command -v /usr/local/bin/npm > /dev/null; then
	npm="/usr/local/bin/npm"
elif command -v /opt/bin/npm > /dev/null; then
	npm="/opt/bin/npm"
elif which npm > /dev/null; then
	npm="$(which npm)"
else
	echo "npm not found. Please install a working version of npm."
	npm=""
fi

# check if git is available
if command -v /usr/bin/git > /dev/null; then
	git="/usr/bin/git"
elif command -v /usr/local/bin/git > /dev/null; then
	git="/usr/local/bin/git"
elif command -v /opt/bin/git > /dev/null; then
	git="/opt/bin/git"
elif command -v /usr/local/git/bin/git > /dev/null; then
	git="/usr/local/git/bin/git"
elif which git > /dev/null; then
	git="$(which git)"
else
	echo "Git not found. Please install a working version of git."
	echo "Synology: \"Git Server\" (official), SynoCommunity's \"git\" or Entware-ng's."
	git=""
fi

# If logfile passed and system is darwin then activate log rotation
if [ "$(uname)" = "Darwin" ] && [ ! -z "$1" ]; then
	newsyslog "$1"
fi

# save today's date
today=$(date +'%Y-%m-%d')

# change dir
cd "$(dirname "$0")" || exit 1

# self update run once daily
if [ -z "${git}" ] || [ -z "${npm}" ]; then
	echo "No git, no npm, no updates..."
elif [ ! -f /tmp/.carddav2phoneUpdate ] || [ "${today}" != "$(date -r /tmp/.carddav2phoneUpdate +'%Y-%m-%d')" ]; then
	echo "Checking for updates..."
	# touch file to indicate update has run once
	touch /tmp/.carddav2phoneUpdate
	# update via git
	$git fetch
	commits=$($git rev-list HEAD...origin/master --count)
	if [ $commits -gt 0 ]; then
		echo "Found a new version, updating..."
		$git pull --force
		$npm install
		echo "Executing new version..."
		exec "$(pwd -P)/carddav2phone.sh"
		# In case executing new fails
		echo "Executing new version failed."
		exit 1
	fi
	echo "No updates available."
else
	echo "Already checked for updates today."
fi

# run node app
$node dist/index.js

# exit
exit 0