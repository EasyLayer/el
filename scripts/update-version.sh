#!/bin/bash

# Stop the script on errors
set -e

# Get environment variables
version=$VERSION

# Update package versions (e.g., 0.0.1)
echo "Setting package versions to: $version"
./node_modules/.bin/lerna version $version --exact --yes --no-git-tag-version --no-push --force-publish=*

# Install dependencies to update Yarn.lock
echo "Updating yarn.lock file"
yarn install

# Add changes to Git
echo "Committing version changes"
git config user.name "github-actions"
git config user.email "github-actions@github.com"
git add **/package.json yarn.lock lerna.json
git status
git commit -m "update version to: $version"

# Push to the Git branch
echo "Pushing to head branch"
git push origin HEAD
