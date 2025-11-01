// Test script to verify URL encoding fix
// This simulates what happens when database contains URL-encoded filenames

console.log('=== Testing URL Encoding Fix ===\n');

// Helper function that mimics the API logic
function constructBlobUrl(directory, fileName) {
    // Same logic as in api/media/index.js
    let blobPath = fileName;
    
    // Decode the blob path in case it contains URL-encoded characters from the database
    try {
        blobPath = decodeURIComponent(blobPath);
    } catch (e) {
        console.log(`Could not decode path: ${blobPath}`, e.message);
    }
    
    // Normalize slashes (after decoding)
    blobPath = blobPath.replace(/\\/g, '/').replace(/\/+/g, '/');
    
    return `/api/media/${encodeURIComponent(blobPath)}`;
}

// Test 1: Normal filename (no encoding in DB)
console.log('Test 1: Normal filename without URL encoding in database');
const test1 = {
    PFileDirectory: "Devorah's Wedding",
    PFileName: "PA130060.JPG"
};
const url1 = constructBlobUrl(test1.PFileDirectory, test1.PFileName);
const expected1 = "/api/media/Devorah's%20Wedding%2FPA130060.JPG";
console.log('  Input:', test1.PFileDirectory + '/' + test1.PFileName);
console.log('  Generated URL:', url1);
console.log('  Expected:', expected1);
console.log('  Match:', url1 === expected1 ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 2: Filename with URL encoding in DB (the problem case)
console.log('Test 2: Filename with URL encoding already in database');
const test2 = {
    PFileDirectory: "Devorah's Wedding",
    PFileName: "PA130060%20(2).JPG"  // Already encoded in DB
};
const url2 = constructBlobUrl(test2.PFileDirectory, test2.PFileName);
const expected2 = "/api/media/Devorah's%20Wedding%2FPA130060%20(2).JPG";  // Should decode then re-encode
console.log('  Input (DB value):', test2.PFileDirectory + '/' + test2.PFileName);
console.log('  Generated URL:', url2);
console.log('  Expected:', expected2);
console.log('  Match:', url2 === expected2 ? '✓ PASS' : '✗ FAIL');

// What happens when browser makes request?
const decodedPath2 = decodeURIComponent(url2.replace('/api/media/', ''));
console.log('  Browser will request blob:', decodedPath2);
console.log('  Actual blob path should be:', "Devorah's Wedding/PA130060 (2).JPG");
console.log('  Paths match:', decodedPath2 === "Devorah's Wedding/PA130060 (2).JPG" ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 3: Filename with apostrophe encoded in DB
console.log('Test 3: Directory name with apostrophe encoded in database');
const test3 = {
    PFileDirectory: "Devorah%27s Wedding",  // Encoded apostrophe in DB
    PFileName: "PA130132.JPG"
};
const url3 = constructBlobUrl(test3.PFileDirectory, test3.PFileName);
const expected3 = "/api/media/Devorah's%20Wedding%2FPA130132.JPG";  // Should decode then re-encode
console.log('  Input (DB value):', test3.PFileDirectory + '/' + test3.PFileName);
console.log('  Generated URL:', url3);
console.log('  Expected:', expected3);
console.log('  Match:', url3 === expected3 ? '✓ PASS' : '✗ FAIL');

const decodedPath3 = decodeURIComponent(url3.replace('/api/media/', ''));
console.log('  Browser will request blob:', decodedPath3);
console.log('  Actual blob path should be:', "Devorah's Wedding/PA130132.JPG");
console.log('  Paths match:', decodedPath3 === "Devorah's Wedding/PA130132.JPG" ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 4: Mixed - directory encoded, filename with spaces
console.log('Test 4: Mixed encoding - directory and filename both have special chars');
const test4 = {
    PFileDirectory: "Summer%202023",  // Encoded space in DB
    PFileName: "Photo%20(1).jpg"       // Encoded space and parentheses in DB
};
const url4 = constructBlobUrl(test4.PFileDirectory, test4.PFileName);
const expected4 = "/api/media/Summer%202023%2FPhoto%20(1).jpg";
console.log('  Input (DB value):', test4.PFileDirectory + '/' + test4.PFileName);
console.log('  Generated URL:', url4);
console.log('  Expected:', expected4);
console.log('  Match:', url4 === expected4 ? '✓ PASS' : '✗ FAIL');

const decodedPath4 = decodeURIComponent(url4.replace('/api/media/', ''));
console.log('  Browser will request blob:', decodedPath4);
console.log('  Actual blob path should be:', "Summer 2023/Photo (1).jpg");
console.log('  Paths match:', decodedPath4 === "Summer 2023/Photo (1).jpg" ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 5: Filename with backslash AND encoding
console.log('Test 5: Filename with backslash and URL encoding');
const test5 = {
    PFileDirectory: "",
    PFileName: "Devorah%27s%20Wedding%5CPA130060.JPG"  // Fully encoded with backslash
};
const url5 = constructBlobUrl(test5.PFileDirectory, test5.PFileName);
const expected5 = "/api/media/Devorah's%20Wedding%2FPA130060.JPG";  // Should decode, normalize, then re-encode
console.log('  Input (DB value):', test5.PFileName);
console.log('  Generated URL:', url5);
console.log('  Expected:', expected5);
console.log('  Match:', url5 === expected5 ? '✓ PASS' : '✗ FAIL');

const decodedPath5 = decodeURIComponent(url5.replace('/api/media/', ''));
console.log('  Browser will request blob:', decodedPath5);
console.log('  Actual blob path should be:', "Devorah's Wedding/PA130060.JPG");
console.log('  Paths match:', decodedPath5 === "Devorah's Wedding/PA130060.JPG" ? '✓ PASS' : '✗ FAIL');
console.log('');

console.log('=== All Tests Complete ===');
