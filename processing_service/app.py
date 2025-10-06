from flask import Flask, send_from_directory, request, jsonify
import os
from dotenv import load_dotenv
from processing_service.processor import process_user_image

load_dotenv()

def create_app():
    app = Flask(__name__, static_folder='../frontend/dist')

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')

    @app.route('/process-image', methods=['POST'])
    def process_image_endpoint():
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 415

        try:
            payload = request.get_json()

            if 'user_image_url' not in payload or 'id' not in payload:
                return jsonify({"error": "Request body must contain 'user_image_url' and 'id'"}), 400

            result_url = process_user_image(payload)

            if result_url:
                return jsonify({"status": "success", "composite_image_url": result_url}), 200
            else:
                return jsonify({"status": "failure", "message": "Image processing failed"}), 500

        except Exception as e:
            app.logger.error(f"Error in /process-image endpoint: {e}")
            return jsonify({"status": "failure", "message": str(e)}), 500

    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get("PORT", 8080))
    app.run(debug=True, host='0.0.0.0', port=port)
