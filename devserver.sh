#!/bin/sh
source .venv/bin/activate
export FLASK_APP="main:create_app()"
python -u -m flask run -p $PORT --debug