#!/bin/bash

# check if run as root
if [ $(id -u "$(whoami)") -ne 0 ]; then
	echo "CardDAV2Phone needs to run as root!"
	exit 1
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

# save today's date
today=$(date +'%Y-%m-%d')

# self update run once daily
if [ ! -z "${git}" ]: then
	echo "No git, no updates..."
elif [ ! -f /tmp/.synoConnectVpnUpdate ] || [ "${today}" != "$(date -r /tmp/.synoConnectVpnUpdate +'%Y-%m-%d')" ]; then
	echo "Checking for updates..."
	# touch file to indicate update has run once
	touch /tmp/.carddav2phoneUpdate
	# change dir and update via git
	cd "$(dirname "$0")" || exit 1
	$git fetch
	commits=$($git rev-list HEAD...origin/master --count)
	if [ $commits -gt 0 ]; then
		echo "Found a new version, updating..."
		$git pull --force
		npm install
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
node index.js

# exit
exit 0