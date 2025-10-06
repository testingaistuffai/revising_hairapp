import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface Image {
  id: number;
  image_url: string;
  image_name: string;
  created_at: string;
}

const SavedImages: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImages = async () => {
      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setImages(data as Image[]);
      }
    };

    fetchImages();
  }, []);

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  return (
    <div style={{ marginTop: '20px' }}>
      <h2>Saved Images</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {images.map(image => (
          <div key={image.id}>
            <img src={image.image_url} alt={image.image_name} style={{ maxWidth: '256px', height: 'auto' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SavedImages;
