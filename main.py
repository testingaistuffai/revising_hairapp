from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Now, check that keys exist before client creation
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# Check if necessary environment variables are set
if not SUPABASE_URL or not SUPABASE_KEY:
    raise EnvironmentError(
        "FATAL: Supabase environment variables are missing. "
        "Please create a .env file with SUPABASE_URL and SUPABASE_KEY."
    )

# Now, create the app using the app factory
from processing_service.app import create_app

app = create_app()

if __name__ == "__main__":
    # This is for local development only.
    # In production, use a WSGI server like Gunicorn.
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
