const fs = require('fs');
let code = fs.readFileSync('src/utils/importInstagram.ts', 'utf8');

code = code.replace(/<<<<<<< Updated upstream[\s\S]*?=======[\s\S]*?>>>>>>> Stashed changes/,
`  // Fetch all post texts concurrently
  const postTexts = await Promise.all(
    postFiles.map(async (postFile) => {
      try {
        return await postFile.async('text')
      } catch {
        return null
      }
    })
  )

  let loaded = 0

  const mediaProcessingPromises: Promise<ImportCandidate>[] = []

  for (const text of postTexts) {
    if (!text) continue
`);

fs.writeFileSync('src/utils/importInstagram.ts', code);
