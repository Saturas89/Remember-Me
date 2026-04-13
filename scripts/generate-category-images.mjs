import fs from 'fs';
import path from 'path';

const dir = 'public/categories';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const templates = {
  childhood: {
    colors: ['#f6d365', '#fda085'],
    shapes: '<circle cx="20%" cy="30%" r="60" fill="rgba(255,255,255,0.2)"/><circle cx="85%" cy="80%" r="120" fill="rgba(255,255,255,0.15)"/><path d="M400,200 Q450,150 500,200 T600,200" stroke="rgba(255,255,255,0.3)" stroke-width="8" fill="none"/>'
  },
  family: {
    colors: ['#ff9a9e', '#fecfef'],
    shapes: '<circle cx="50%" cy="50%" r="100" fill="rgba(255,255,255,0.2)"/><circle cx="45%" cy="45%" r="80" fill="rgba(255,255,255,0.2)"/><circle cx="55%" cy="55%" r="80" fill="rgba(255,255,255,0.2)"/>'
  },
  career: {
    colors: ['#84fab0', '#8fd3f4'],
    shapes: '<polygon points="0,200 200,100 400,150 800,0 800,200" fill="rgba(255,255,255,0.2)"/><polygon points="0,200 300,120 500,160 800,50 800,200" fill="rgba(255,255,255,0.1)"/>'
  },
  values: {
    colors: ['#a18cd1', '#fbc2eb'],
    shapes: '<polygon points="400,20 440,100 520,100 460,150 480,230 400,180 320,230 340,150 280,100 360,100" fill="rgba(255,255,255,0.2)"/>'
  },
  memories: {
    colors: ['#ffecd2', '#fcb69f'],
    shapes: '<rect x="10%" y="20%" width="30%" height="50%" rx="8" fill="rgba(255,255,255,0.3)" transform="rotate(-10 100 100)"/><rect x="60%" y="30%" width="25%" height="40%" rx="8" fill="rgba(255,255,255,0.2)" transform="rotate(15 600 100)"/>'
  },
  legacy: {
    colors: ['#30cfd0', '#330867'],
    shapes: '<ellipse cx="50%" cy="100%" rx="70%" ry="60%" fill="rgba(255,255,255,0.1)"/><circle cx="80%" cy="20%" r="4" fill="#fff"/><circle cx="70%" cy="30%" r="2" fill="#fff"/><circle cx="85%" cy="40%" r="3" fill="#fff"/>'
  },
  custom: {
    colors: ['#cfd9df', '#e2ebf0'],
    shapes: '<path d="M0,100 Q200,50 400,100 T800,100 L800,200 L0,200 Z" fill="rgba(255,255,255,0.4)"/><circle cx="50%" cy="50%" r="40" fill="rgba(255,255,255,0.5)"/>'
  }
};

for (const [key, data] of Object.entries(templates)) {
  const banner = `<svg width="800" height="240" viewBox="0 0 800 240" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="grad-${key}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${data.colors[0]};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${data.colors[1]};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad-${key})" />
    ${data.shapes}
  </svg>`;

  const preview = `<svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="grad-${key}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${data.colors[0]};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${data.colors[1]};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad-${key})" />
    <g transform="scale(0.5) translate(200, 50)">
      ${data.shapes}
    </g>
  </svg>`;

  fs.writeFileSync(path.join(dir, key + '-banner.svg'), banner);
  fs.writeFileSync(path.join(dir, key + '-preview.svg'), preview);
}

console.log('Category images generated successfully.');
