#!/usr/bin/zsh

rm ./dist/*

python3 -m build
pip3 install dist/kleinkram*.whl --force-reinstall