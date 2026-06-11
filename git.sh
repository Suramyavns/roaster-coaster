#!/bin/bash

git init
git add .
git commit -m "version 1"
git branch -M main
git remote add origin https://github.com/Suramyavns/roaster-coaster.git
git push -u origin main