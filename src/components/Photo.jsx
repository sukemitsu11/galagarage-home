import { useState } from 'react';
import { thumb } from '../lib.js';

// A product photo. With `small` it loads the light copy made at upload and falls back to the original
// when that copy does not exist.
export default function Photo({ src, small = false, alt = '', ...props }) {
  const [missing, setMissing] = useState('');
  const url = small && missing !== src ? thumb(src) : src;
  return <img src={url} alt={alt} onError={() => { if (url !== src) setMissing(src); }} {...props} />;
}
