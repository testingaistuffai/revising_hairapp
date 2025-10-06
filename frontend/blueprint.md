## Purpose and Capabilities

This project is a React application that allows users to upload an image, segment the hair, and apply a new color or hairstyle to it. The application uses a machine learning model to perform the hair segmentation and Supabase for storing and retrieving images and masks.

## Project Outline

### Styling and Design

*   **Component Library:** None explicitly used, but the application has a clean and simple design.
*   **Styling:** CSS is used for styling, with a focus on a clear and intuitive layout.
*   **Visual Effects:** The application uses a multi-layered drop shadow to create a sense of depth.

### Features

*   **Image Upload:** Users can upload an image from their local machine.
*   **Hair Segmentation:** The application uses a MediaPipe hair segmentation model to create a mask of the user's hair.
*   **Hairstyle Application:** Users can select a hairstyle from a dropdown menu and apply it to their uploaded image.
*   **Color Picker:** Users can select a color to apply to their hair.
*   **Image Saving:** Users can save the resulting image to their local machine.

## Current Request

**Request:** The user wants to change the input mask URL from a textbox to a dropdown menu that lists mask images from the Supabase bucket 'masks'.

**Plan:**

1.  **Analyze Existing Code:** Examine the `ImageUploader.tsx` component to understand how the mask URL is currently handled.
2.  **Implement Dropdown:** Replace the text input with a dropdown menu.
3.  **Fetch Masks from Supabase:** Fetch the list of masks from the 'masks' bucket in Supabase.
4.  **Populate Dropdown:** Populate the dropdown menu with the fetched masks.
5.  **Update State:** Update the component's state when a mask is selected from the dropdown.
6.  **Update Blueprint:** Update the `blueprint.md` file to reflect the changes made.