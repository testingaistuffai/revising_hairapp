#!/bin/sh
source .venv/bin/activate

# Build the frontend
npm run build --prefix frontend

export FLASK_APP="main:create_app()"
python -u -m flask run -p $PORT --debug