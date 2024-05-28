#!/usr/bin/zsh

rm ./dist/*

python3 -m build
pip3 install dist/eth_gtd_cli-0.0.104-py3-none-any.whl --force-reinstall