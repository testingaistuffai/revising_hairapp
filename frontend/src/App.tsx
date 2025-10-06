
import './App.css';
import ImageUploader from './ImageUploader.tsx';
import SavedImages from './SavedImages.tsx';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Image Uploader</h1>
        <ImageUploader />
      </header>
      <main>
        <SavedImages />
      </main>
    </div>
  );
}

export default App;
