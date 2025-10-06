#!/bin/sh
source .venv/bin/activate

# Build the frontend
npm run build --prefix frontend

export PORT=${PORT:-5000}
export FLASK_APP="main:create_app()"
python -u -m flask run --debug -p $PORT