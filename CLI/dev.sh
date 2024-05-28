#!/usr/bin/zsh

rm ./dist/*

python3 -m build
pip3 install dist/eth_gtd_cli*.whl --force-reinstall