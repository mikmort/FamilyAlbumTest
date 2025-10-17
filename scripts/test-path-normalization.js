// Test script to verify path normalization logic

console.log('=== Testing Path Normalization Logic ===\n');

// Test 1: Filename with backslash
console.log('Test 1: Filename with backslash');
const test1 = {
    PFileDirectory: '',
    PFileName: "Devorah's Wedding\\PA130060.JPG"
};

let blobPath1 = test1.PFileName;
blobPath1 = blobPath1.replace(/\\/g, '/').replace(/\/+/g, '/');
const url1 = `/api/media/${encodeURIComponent(blobPath1)}`;

console.log('  Input PFileName:', test1.PFileName);
console.log('  Normalized blobPath:', blobPath1);
console.log('  Generated URL:', url1);
console.log('  Expected: /api/media/Devorah\'s%20Wedding%2FPA130060.JPG');
console.log('  Match:', url1 === "/api/media/Devorah's%20Wedding%2FPA130060.JPG" ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 2: Directory and filename both without slashes
console.log('Test 2: Directory and filename combined');
const test2 = {
    PFileDirectory: 'Summer 2023',
    PFileName: 'IMG_001.jpg'
};

let blobPath2;
if (test2.PFileDirectory) {
    blobPath2 = `${test2.PFileDirectory}/${test2.PFileName}`;
} else {
    blobPath2 = test2.PFileName;
}
blobPath2 = blobPath2.replace(/\\/g, '/').replace(/\/+/g, '/');
const url2 = `/api/media/${encodeURIComponent(blobPath2)}`;

console.log('  Input PFileDirectory:', test2.PFileDirectory);
console.log('  Input PFileName:', test2.PFileName);
console.log('  Normalized blobPath:', blobPath2);
console.log('  Generated URL:', url2);
console.log('  Expected: /api/media/Summer%202023%2FIMG_001.jpg');
console.log('  Match:', url2 === '/api/media/Summer%202023%2FIMG_001.jpg' ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 3: Directory with backslash
console.log('Test 3: Directory with backslash');
const test3 = {
    PFileDirectory: 'Family\\Reunion',
    PFileName: 'photo.jpg'
};

let blobPath3;
if (test3.PFileDirectory) {
    blobPath3 = `${test3.PFileDirectory}/${test3.PFileName}`;
} else {
    blobPath3 = test3.PFileName;
}
blobPath3 = blobPath3.replace(/\\/g, '/').replace(/\/+/g, '/');
const url3 = `/api/media/${encodeURIComponent(blobPath3)}`;

console.log('  Input PFileDirectory:', test3.PFileDirectory);
console.log('  Input PFileName:', test3.PFileName);
console.log('  Normalized blobPath:', blobPath3);
console.log('  Generated URL:', url3);
console.log('  Expected: /api/media/Family%2FReunion%2Fphoto.jpg');
console.log('  Match:', url3 === '/api/media/Family%2FReunion%2Fphoto.jpg' ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 4: Filename already contains directory with backslashes
console.log('Test 4: Filename already contains full path with backslashes');
const test4 = {
    PFileDirectory: 'Events',
    PFileName: 'Events\\Wedding\\ceremony.jpg'
};

let blobPath4;
if (test4.PFileDirectory && test4.PFileName.startsWith(test4.PFileDirectory)) {
    blobPath4 = test4.PFileName;
} else if (test4.PFileDirectory) {
    blobPath4 = `${test4.PFileDirectory}/${test4.PFileName}`;
} else {
    blobPath4 = test4.PFileName;
}
blobPath4 = blobPath4.replace(/\\/g, '/').replace(/\/+/g, '/');
const url4 = `/api/media/${encodeURIComponent(blobPath4)}`;

console.log('  Input PFileDirectory:', test4.PFileDirectory);
console.log('  Input PFileName:', test4.PFileName);
console.log('  Normalized blobPath:', blobPath4);
console.log('  Generated URL:', url4);
console.log('  Expected: /api/media/Events%2FWedding%2Fceremony.jpg');
console.log('  Match:', url4 === '/api/media/Events%2FWedding%2Fceremony.jpg' ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 5: Decoding and re-normalizing (simulates API receiving a request)
console.log('Test 5: API receives request with encoded backslash');
const encodedUrl = 'Devorah\'s%20Wedding%5CPA130060.JPG';
let decodedFilename = decodeURIComponent(encodedUrl);
console.log('  Encoded URL parameter:', encodedUrl);
console.log('  Decoded filename:', decodedFilename);

decodedFilename = decodedFilename.replace(/\\/g, '/');
console.log('  After normalization:', decodedFilename);
console.log('  Expected: Devorah\'s Wedding/PA130060.JPG');
console.log('  Match:', decodedFilename === "Devorah's Wedding/PA130060.JPG" ? '✓ PASS' : '✗ FAIL');
console.log('');

console.log('=== All Tests Complete ===');
