
const https = require('https');
const fs = require('fs');
const path = require('path');

const modelUrl = 'https://storage.googleapis.com/mediapipe-assets/hair_segmentation.tflite';
const modelPath = path.resolve(__dirname, '../public/hair_segmenter.tflite');

if (!fs.existsSync(modelPath)) {
  console.log('Hair Segmenter model not found. Downloading...');
  const file = fs.createWriteStream(modelPath);
  https.get(modelUrl, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Hair Segmenter model downloaded successfully.');
    });
  }).on('error', (err) => {
    fs.unlink(modelPath, () => {}); // Delete the file if download fails
    console.error('Error downloading model:', err.message);
  });
} else {
  console.log('Hair Segmenter model already exists.');
}
