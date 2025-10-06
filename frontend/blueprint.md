# Project Blueprint

## Overview

This project is a React web application that allows users to upload an image, automatically generate a hair mask using a MediaPipe model, and then change the hair color. The application also features the ability to apply an existing hair mask to a new image, save the final edited image, and view a gallery of all saved results. All images and metadata are stored and managed using Supabase.

## Key Features

- **Image Upload & Segmentation:**
  - Users can upload a PNG or JPG file or use a provided sample image.
  - The application utilizes the MediaPipe Image Segmenter to automatically detect and create a precise hair mask from the uploaded image.

- **Hair Color Customization:**
  - A color picker allows users to select a new hair color.
  - The selected color is blended with the original hair texture within the masked area for a realistic effect.

- **Advanced Mask Application:**
  - Users can apply a hair mask from a URL to a completely different base image.
  - The application intelligently segments the new base image to find the hair's bounding box, then resizes and positions the provided mask for an accurate fit.

- **Image Storage & Management (Supabase):**
  - **Supabase Storage:** The project uses three separate storage buckets:
    - `images`: Stores the original user-uploaded images.
    - `masks`: Stores the generated hair mask images.
    - `results`: Stores the final, edited images with the new hair color.
  - **Supabase Database:** The `uploads` table tracks image metadata, including:
    - `image_name`: The name of the file.
    - `image_url`: The public URL for the image in the `images` or `results` bucket.
    - `mask_url`: The public URL for the corresponding mask in the `masks` bucket.
    - `segmentation_metadata`: Labels from the MediaPipe model.
    - `hair_bounding_box`: The coordinates of the detected hair region.

- **Saved Images Gallery:**
  - The application fetches and displays a gallery of all previously saved final images from the `results` bucket.

## Project Structure

- **`src/` - Source Code**
  - **`components/`**: Contains the main React components.
    - `App.tsx`: The main application component that orchestrates the UI.
    - `ImageUploader.tsx`: Core component handling file uploads, segmentation, color application, and all Supabase interactions.
    - `ColorPicker.tsx`: A simple component for selecting a hair color.
    - `SavedImages.tsx`: Renders the gallery of images fetched from Supabase.
  - **`utils/`**: Contains helper modules and utility functions.
    - `imageUtils.ts`: Reusable functions for image manipulation (loading, data conversion, color conversion).
    - `logger.ts`: Wrappers for console logging, allowing for conditional logging (e.g., only in development).
  - **`supabaseClient.ts`**: Initializes and exports the Supabase client.
- **`scripts/`**: Contains build-related scripts.
  - `download-model.cjs`: A `postinstall` script that automatically downloads the required MediaPipe TFLite model.

## Development Conventions

To maintain a clean and modular codebase, please adhere to the following conventions:

- **Logging:** All console logging, errors, and debug outputs should be handled by the functions in `src/utils/logger.ts`. This allows for centralized control over log visibility based on the environment (e.g., development vs. production).
- **Image Utilities:** Reusable functions related to image processing, such as data conversion or color manipulation, should be placed in `src/utils/imageUtils.ts`.
- **Component Logic:** Components should focus on state management and UI rendering, delegating complex data manipulation or business logic to utility functions whenever possible.

## Recent Changes (as of 2025-10-03)

- **Code Refactoring:**
  - Modularized the codebase by creating a `src/utils` directory.
  - Extracted image-related helpers into `src/utils/imageUtils.ts`.
  - Centralized all console logging into `src/utils/logger.ts`.
  - Refactored `ImageUploader.tsx` to be cleaner and use the new utility modules.
- **Dependency Cleanup:**
  - Corrected an import typo for `@mediapipe/tasks-vision`.
  - Removed an incorrect and unnecessary `node.js` dependency from `package.json`.