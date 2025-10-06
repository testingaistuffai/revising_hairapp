import React, { useState, useRef, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';
import ColorPicker from './ColorPicker';
import { loadImage, dataURLtoBlob, hexToRgb } from './utils/imageUtils';
import { log, logError } from './utils/logger';

const getHairBoundingBox = (width: number, height: number, maskData: Uint8Array) => {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let foundHair = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const maskVal = maskData[index];
      if (maskVal === 1) { // Assuming 1 is the hair category
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        foundHair = true;
      }
    }
  }

  if (foundHair) {
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }
  return null;
};

const ImageUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [maskImageUrl, setMaskImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageSegmenterRef = useRef<ImageSegmenter | null>(null);
  const labelsRef = useRef<string[]>([]);

  const [maskUrlInput, setMaskUrlInput] = useState<string>('');
  const [baseImageForMasking, setBaseImageForMasking] = useState<File | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('#FF0000');

  useEffect(() => {
    const createImageSegmenter = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
          },
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
        imageSegmenterRef.current = imageSegmenter;
        labelsRef.current = imageSegmenter.getLabels();
        log("ImageSegmenter Initialized. Labels:", labelsRef.current);
      } catch (e) {
        logError("Failed to create ImageSegmenter:", e);
        setError("Could not initialize the image segmentation model. Please refresh the page.");
      }
    };
    createImageSegmenter();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setOriginalImageUrl(URL.createObjectURL(selectedFile));
      setMaskImageUrl(null);
      setResultImageUrl(null);
      setError(null);
    }
  };

  const processImage = async (imageFile: File | null) => {
    if (!imageFile || !imageSegmenterRef.current) {
      setError('Please select a file and wait for the model to load.');
      return;
    }

    setProcessing(true);
    setError(null);
    setMaskImageUrl(null);

    try {
      const { data: existingUploads, error: selectError } = await supabase
        .from('uploads')
        .select('*')
        .eq('image_name', imageFile.name)
        .maybeSingle();

      if (selectError) throw selectError;

      if (existingUploads?.mask_url && existingUploads?.hair_bounding_box) {
        setMaskImageUrl(existingUploads.mask_url);
        setError('Image already processed. Using existing mask.');
        return;
      }

      const img = await loadImage(URL.createObjectURL(imageFile));
      const imageSegmenter = imageSegmenterRef.current;
      const result = await imageSegmenter.segment(img);

      if (!result || !result.categoryMask) {
        throw new Error("Image segmentation failed to produce a category mask.");
      }

      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas element not found.");
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context.");

      canvas.width = result.categoryMask.width;
      canvas.height = result.categoryMask.height;

      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = img.width;
      originalCanvas.height = img.height;
      const originalCtx = originalCanvas.getContext('2d');
      if (!originalCtx) throw new Error("Could not get original canvas context.");
      originalCtx.drawImage(img, 0, 0, img.width, img.height);
      const originalImageData = originalCtx.getImageData(0, 0, img.width, img.height);

      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const maskData = result.categoryMask.getAsUint8Array();

      if (!maskData || maskData.length === 0) {
        setError("Segmentation successful, but no mask data found in the image.");
        return;
      }

      for (let i = 0; i < maskData.length; i++) {
        if (maskData[i] === 1) { // Hair category
          const p = i * 4;
          imageData.data[p] = originalImageData.data[p];
          imageData.data[p + 1] = originalImageData.data[p + 1];
          imageData.data[p + 2] = originalImageData.data[p + 2];
          imageData.data[p + 3] = 255;
        } 
      }
      ctx.putImageData(imageData, 0, 0);
      const generatedMaskDataURL = canvas.toDataURL('image/png');
      setMaskImageUrl(generatedMaskDataURL);

      const hairBoundingBox = getHairBoundingBox(result.categoryMask.width, result.categoryMask.height, maskData);
      const maskBlob = dataURLtoBlob(generatedMaskDataURL);
      const lastDotIndex = imageFile.name.lastIndexOf('.');
      const nameWithoutExtension = lastDotIndex > 0 ? imageFile.name.substring(0, lastDotIndex) : imageFile.name;
      const maskImageFilePath = `mask-${nameWithoutExtension}.png`;
      log('Attempting to upload mask to Supabase Storage:', { path: maskImageFilePath });
      const { error: maskUploadError } = await supabase.storage
        .from('masks')
        .upload(maskImageFilePath, maskBlob, { upsert: true });

      if (maskUploadError) throw maskUploadError;
      const { data: { publicUrl: maskPublicUrl } } = supabase.storage.from('masks').getPublicUrl(maskImageFilePath);

      let originalPublicUrl = existingUploads?.image_url;
      if (!originalPublicUrl) {
        const originalImageFilePath = `${imageFile.name}`;
        const { error: originalUploadError } = await supabase.storage
          .from('images')
          .upload(originalImageFilePath, imageFile, { upsert: true });
        if (originalUploadError) throw originalUploadError;
        originalPublicUrl = supabase.storage.from('images').getPublicUrl(originalImageFilePath).data.publicUrl;
      }

      const metadataToSave = {
        image_name: imageFile.name,
        image_url: originalPublicUrl,
        mask_url: maskPublicUrl,
        segmentation_metadata: labelsRef.current,
        hair_bounding_box: hairBoundingBox,
      };

      log('Attempting to upsert metadata to "uploads" table:', metadataToSave);
      const { error: upsertError } = await supabase.from('uploads').upsert(metadataToSave, { onConflict: 'image_name' });
      if (upsertError) throw upsertError;

    } catch (err: unknown) {
      logError("Error processing image: ", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setProcessing(false);
    }
  };

  const handleTestProcess = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/test-images/fcdf2239-0ca5-437c-80c2-d4c1624de3aa.jpg');
      const blob = await response.blob();
      const testFile = new File([blob], 'test-image.jpg', { type: 'image/jpeg' });
      setFile(testFile);
      setOriginalImageUrl(URL.createObjectURL(testFile));
      await processImage(testFile);
    } catch (err: unknown) {
      logError('Error fetching test image:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching the test image.');
    } finally {
      setProcessing(false);
    }
  };

  const handleBaseImageForMaskingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBaseImageForMasking(e.target.files[0]);
      setResultImageUrl(null);
      setError(null);
    }
  };

  const applyMask = async () => {
    if (!baseImageForMasking || !maskUrlInput || !imageSegmenterRef.current) {
      setError('Please select a base image, provide a mask URL, and wait for the model to load.');
      return;
    }

    setProcessing(true);
    setError(null);
    setResultImageUrl(null);

    try {
      const baseImg = await loadImage(URL.createObjectURL(baseImageForMasking));
      const imageSegmenter = imageSegmenterRef.current;
      const segmentationResult = await imageSegmenter.segment(baseImg);
      if (!segmentationResult?.categoryMask) {
        throw new Error("Segmentation failed for the base image.");
      }

      const hairBoundingBox = getHairBoundingBox(segmentationResult.categoryMask.width, segmentationResult.categoryMask.height, segmentationResult.categoryMask.getAsUint8Array());
      if (!hairBoundingBox) {
        throw new Error("No hair found in the base image.");
      }

      const maskImg = await loadImage(maskUrlInput);

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = baseImg.width;
      outputCanvas.height = baseImg.height;
      const outputCtx = outputCanvas.getContext('2d');
      if (!outputCtx) throw new Error("Could not get output canvas context.");
      
      outputCtx.drawImage(baseImg, 0, 0);

      const tempMaskCanvas = document.createElement('canvas');
      tempMaskCanvas.width = baseImg.width;
      tempMaskCanvas.height = baseImg.height;
      const tempMaskCtx = tempMaskCanvas.getContext('2d');
      if (!tempMaskCtx) throw new Error("Could not get temp mask canvas context.");
      
      tempMaskCtx.drawImage(maskImg, hairBoundingBox.minX, hairBoundingBox.minY, hairBoundingBox.width, hairBoundingBox.height);

      const tempMaskImageData = tempMaskCtx.getImageData(0, 0, baseImg.width, baseImg.height);
      const baseImageData = outputCtx.getImageData(0, 0, baseImg.width, baseImg.height);
      const colorRgb = hexToRgb(selectedColor);
      if (!colorRgb) throw new Error("Invalid color selected");

      for (let i = 0; i < baseImageData.data.length; i += 4) {
        const maskAlpha = tempMaskImageData.data[i + 3];
        if (maskAlpha > 0) {
          const blendAmount = (maskAlpha / 255) * 0.7;
          baseImageData.data[i] = baseImageData.data[i] * (1 - blendAmount) + colorRgb.r * blendAmount;
          baseImageData.data[i + 1] = baseImageData.data[i + 1] * (1 - blendAmount) + colorRgb.g * blendAmount;
          baseImageData.data[i + 2] = baseImageData.data[i + 2] * (1 - blendAmount) + colorRgb.b * blendAmount;
        }
      }

      outputCtx.putImageData(baseImageData, 0, 0);
      setResultImageUrl(outputCanvas.toDataURL('image/png'));

    } catch (err: unknown) {
      logError("Error applying mask: ", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while applying the mask.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveImage = async () => {
    if (!resultImageUrl) return;

    setProcessing(true);
    setError(null);
    try {
      const resultBlob = dataURLtoBlob(resultImageUrl);
      const resultFileName = `result-${baseImageForMasking?.name || 'image.png'}`;
      const { error: uploadError } = await supabase.storage
        .from('results')
        .upload(resultFileName, resultBlob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('results').getPublicUrl(resultFileName);

      const { error: dbError } = await supabase.from('uploads').insert([
        {
          image_name: resultFileName,
          image_url: publicUrl,
          mask_url: maskUrlInput, // Save the mask URL used for this result
        },
      ]);

      if (dbError) throw dbError;

      alert('Image saved successfully!');
    } catch (err: unknown) {
      logError("Error saving image: ", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while saving the image.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <input type="file" accept=".png,.jpg" onChange={handleFileChange} disabled={processing} />
      <button onClick={() => processImage(file)} disabled={!file || processing}>
        {processing ? 'Processing...' : 'Process Image'}
      </button>
      <button onClick={handleTestProcess} disabled={processing}>
        Test with Sample Image
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'flex', marginTop: '20px', gap: '20px' }}>
        {originalImageUrl && (
          <div>
            <h3>Original:</h3>
            <img src={originalImageUrl} alt="Original" style={{ maxWidth: '256px', height: 'auto' }} />
          </div>
        )}
        {maskImageUrl && (
          <div>
            <h3>Hair Mask:</h3>
            <img src={maskImageUrl} alt="Hair Mask" style={{ maxWidth: '256px', height: 'auto' }} />
          </div>
        )}
      </div>

      <hr style={{ margin: '40px 0' }} />

      <h2>Apply Existing Mask</h2>
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="maskUrlInput">Mask Image URL:</label>
        <input
          id="maskUrlInput"
          type="text"
          value={maskUrlInput}
          onChange={(e) => setMaskUrlInput(e.target.value)}
          placeholder="Paste mask image URL here"
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          disabled={processing}
        />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="baseImageInput">Upload Base Image:</label>
        <input
          id="baseImageInput"
          type="file"
          accept=".png,.jpg"
          onChange={handleBaseImageForMaskingChange}
          disabled={processing}
        />
      </div>
      <ColorPicker selectedColor={selectedColor} onColorChange={setSelectedColor} />
      <button onClick={applyMask} disabled={processing || !baseImageForMasking || !maskUrlInput}>
        {processing ? 'Applying...' : 'Apply Mask'}
      </button>

      {resultImageUrl && (
        <div style={{ marginTop: '20px' }}>
          <h3>Image with New Hair:</h3>
          <img src={resultImageUrl} alt="Result with new hair" style={{ maxWidth: '256px', height: 'auto' }} />
          <button onClick={handleSaveImage} disabled={processing}>
            {processing ? 'Saving...' : 'Save Image'}
          </button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default ImageUploader;