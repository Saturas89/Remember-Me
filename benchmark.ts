import JSZip from 'jszip';
import { parseInstagramZip } from './src/utils/importInstagram';

async function generateFakeInstagramZip(numPosts: number): Promise<File> {
  const zip = new JSZip();

  const posts = [];
  for (let i = 0; i < numPosts; i++) {
    const uri = `media/post${i}.jpg`;
    zip.file(uri, new Uint8Array(100 * 1024)); // 100kb fake image
    posts.push({
      media: [{
        uri,
        creation_timestamp: Date.now() / 1000,
        title: `Post ${i}`
      }]
    });
  }

  zip.file('posts_1.json', JSON.stringify(posts));

  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'instagram_export.zip');
}

async function runBenchmark() {
  console.log('Generating fake zip...');
  const file = await generateFakeInstagramZip(200);

  console.log('Running benchmark...');
  const start = performance.now();

  const candidates = await parseInstagramZip(file);

  const end = performance.now();
  console.log(`Parsed ${candidates.length} candidates in ${(end - start).toFixed(2)} ms`);
}

runBenchmark().catch(console.error);
