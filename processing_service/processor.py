import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import cv2
import numpy as np
import mediapipe as mp
from supabase import create_client, Client
import requests
import json

# --- MediaPipe Model Paths ---
SEGMENTER_MODEL_PATH = os.environ.get("SEGMENTER_MODEL_PATH", "models/hair_segmenter.tflite")
LANDMARKER_MODEL_PATH = os.environ.get("LANDMARKER_MODEL_PATH", "models/face_landmarker.task")

# --- MediaPipe Initialization ---
BaseOptions = mp.tasks.BaseOptions
ImageSegmenter = mp.tasks.vision.ImageSegmenter
ImageSegmenterOptions = mp.tasks.vision.ImageSegmenterOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# --- Supabase Initialization ---
supabase_client = None

def get_supabase_client():
    global supabase_client
    if supabase_client is None:
        SUPABASE_URL = os.environ.get("SUPABASE_URL")
        SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("Supabase URL and Key must be set in environment variables.")
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase_client

# Create an ImageSegmenter object.
base_options_segmenter = BaseOptions(model_asset_path=SEGMENTER_MODEL_PATH)
options_segmenter = ImageSegmenterOptions(base_options=base_options_segmenter,
                                          running_mode=VisionRunningMode.IMAGE,
                                          output_category_mask=True)
segmenter = ImageSegmenter.create_from_options(options_segmenter)

# Create a FaceLandmarker object.
base_options_landmarker = BaseOptions(model_asset_path=LANDMARKER_MODEL_PATH)
options_landmarker = FaceLandmarkerOptions(base_options=base_options_landmarker,
                                           running_mode=VisionRunningMode.IMAGE,
                                           output_face_blendshapes=True,
                                           output_facial_transformation_matrixes=True,
                                           num_faces=1)
landmarker = FaceLandmarker.create_from_options(options_landmarker)


def get_hair_bounding_box(width, height, mask_data):
    min_x, min_y = width, height
    max_x, max_y = 0, 0
    found_hair = False

    for y in range(height):
        for x in range(width):
            if mask_data[y, x] == 1:  # Assuming hair is category 1
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
                found_hair = True

    if found_hair:
        return {
            "min_x": min_x, "min_y": min_y,
            "max_x": max_x, "max_y": max_y,
            "width": max_x - min_x + 1,
            "height": max_y - min_y + 1
        }
    return None

def process_user_image(row_data):
    """
    Processes a user image by running hair segmentation and face landmarking,
    calculates a homography matrix, warps a mask, and saves the result.
    """
    supabase = get_supabase_client()
    
    print(f"Processing row: {row_data}")
    user_image_path = row_data.get('user_image_url') # This is now a local path
    mask_image_url = row_data.get('mask_image_url')
    row_id = row_data.get('id')

    if not all([user_image_path, mask_image_url, row_id]):
        raise ValueError("Missing required data in the input row.")

    user_image_url = None
    composite_url = None # Initialize composite_url
    try:
        # Upload user image to Supabase Storage first
        with open(user_image_path, 'rb') as f:
            file_content = f.read()
        
        user_image_name = os.path.basename(user_image_path)
        upload_response = supabase.storage.from_('uploads').upload(
            user_image_name,
            file_content,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
        user_image_url = supabase.storage.from_('uploads').get_public_url(user_image_name)

        # 1. Download images from Supabase (now user_image is also from Supabase)
        user_image_response = requests.get(user_image_url, stream=True)
        user_image_response.raise_for_status()
        user_image_data = np.frombuffer(user_image_response.content, np.uint8)
        user_image = cv2.imdecode(user_image_data, cv2.IMREAD_COLOR)
        user_image_rgb = cv2.cvtColor(user_image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=user_image_rgb)

        mask_image_response = requests.get(mask_image_url, stream=True)
        mask_image_response.raise_for_status()
        mask_image_data = np.frombuffer(mask_image_response.content, np.uint8)
        mask_image = cv2.imdecode(mask_image_data, cv2.IMREAD_UNCHANGED) # Keep alpha

    except requests.exceptions.RequestException as e:
        print(f"Error downloading images: {e}")
        return None
    except Exception as e:
        print(f"Error uploading user image to Supabase: {e}")
        return None

    # --- Pass 1: Segmentation ---
    segmentation_result = segmenter.segment(mp_image)
    category_mask = segmentation_result.category_mask
    hair_mask_data = category_mask.numpy_view()
    hair_bb = get_hair_bounding_box(mp_image.width, mp.image.height, hair_mask_data)

    # --- Pass 2: Face Landmarking ---
    landmark_result = landmarker.detect(mp_image)
    face_landmarks = landmark_result.face_landmarks[0] # Assuming one face
    
    landmarks_json = [{ "x": lm.x, "y": lm.y, "z": lm.z } for lm in face_landmarks]


    # --- Homography Calculation ---
    # 5. Define Homography Source Points (Normalized)
    p_src = np.array([
        [0.5, 0.05],  # Forehead center
        [0.2, 0.3],   # Left temple
        [0.8, 0.3],   # Right temple
        [0.5, 0.9]    # Chin
    ], dtype=np.float32)

    # 6. Define Homography Destination Points (from landmarks)
    dst_indices = [10, 132, 361, 152] # Forehead, Left Temple, Right Temple, Chin
    p_dst_normalized = np.array([
        [face_landmarks[i].x, face_landmarks[i].y] for i in dst_indices
    ], dtype=np.float32)
    
    # Convert destination points to pixel coordinates
    h, w, _ = user_image.shape
    p_dst_pixels = p_dst_normalized * np.array([w, h], dtype=np.float32)
    
    # Convert source points to pixel coordinates based on the mask image dimensions
    mask_h, mask_w, _ = mask_image.shape
    p_src_pixels = p_src * np.array([mask_w, mask_h], dtype=np.float32)


    # 7. Calculate Homography Matrix
    homography_matrix, _ = cv2.getPerspectiveTransform(p_src_pixels, p_dst_pixels)

    # --- Warping & Blending ---
    warped_mask = cv2.warpPerspective(mask_image, homography_matrix, (w, h))

    # Simple alpha blend
    warped_mask_alpha = warped_mask[:, :, 3] / 255.0
    warped_mask_rgb = warped_mask[:, :, :3]

    # Create a 3-channel alpha mask for broadcasting
    alpha_3ch = cv2.merge([warped_mask_alpha, warped_mask_alpha, warped_mask_alpha])

    # Blend
    composite_image = (warped_mask_rgb * alpha_3ch + user_image * (1 - alpha_3ch)).astype(np.uint8)
    
    # --- I/O and Database Update ---
    # 8. Upload composite image to Supabase
    composite_filename = f"composite_{row_id}.png"
    _, composite_buffer = cv2.imencode('.png', composite_image)
    
    try:
        supabase.storage.from_('composites').upload(
            composite_filename,
            composite_buffer.tobytes(),
            file_options={"content-type": "image/png", "upsert": "true"}
        )
        composite_url = supabase.storage.from_('composites').get_public_url(composite_filename)

        # 9. Update the database row
        update_data = {
            "status": "completed",
            "composite_image_url": composite_url,
            "face_landmarks_json": json.dumps(landmarks_json),
            "hair_bounding_box": json.dumps(hair_bb)
        }
        supabase.table('processing_queue').update(update_data).eq('id', row_id).execute()
        print(f"Successfully processed and updated row {row_id}")
        return composite_url # Return the composite URL

    except Exception as e:
        print(f"Error uploading to Supabase or updating table: {e}")
        # Optionally update the row to an error state
        supabase.table('processing_queue').update({"status": "failed", "error_message": str(e)}).eq('id', row_id).execute()
        return None


# 10. Local Runner for testing
if __name__ == "__main__":
    print("Running local test...")
    # This is a placeholder. In a real scenario, you would get this from a Supabase trigger.
    # You need to have valid image URLs in your Supabase storage for this to work.
    test_row = {
        "id": "test-12345",
        "user_image_url": "https://your-supabase-url.co/storage/v1/object/public/user_images/some_user_image.jpg",
        "mask_image_url": "https://your-supabase-url.co/storage/v1/object/public/mask_images/some_mask.png",
    }
    
    # Make sure to set your environment variables (SUPABASE_URL, SUPABASE_KEY)
    # and have the model files available at the specified paths.
    if not all([os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")]):
        print("Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set.")
    else:
        try:
            process_user_image(test_row)
        except Exception as e:
            print(f"An error occurred during local test run: {e}")
