// Test script to verify URL encoding fix for image paths

// Test case: Devorah's Wedding path
const testCases = [
    {
        name: "Devorah's Wedding with apostrophe in directory and filename",
        directory: "Devorah's Wedding",
        filename: "Devorah's Wedding 025.jpg",
        expectedBlobPath: "Devorah's Wedding/Devorah's Wedding 025.jpg",
        expectedUrl: "/api/media/Devorah%27s%20Wedding/Devorah%27s%20Wedding%20025.jpg"
    },
    {
        name: "Simple filename with space",
        directory: "Family Pictures",
        filename: "Photo 001.jpg",
        expectedBlobPath: "Family Pictures/Photo 001.jpg",
        expectedUrl: "/api/media/Family%20Pictures/Photo%20001.jpg"
    },
    {
        name: "Filename with special characters",
        directory: "Events & Parties",
        filename: "New Year's Eve 2023.jpg",
        expectedBlobPath: "Events & Parties/New Year's Eve 2023.jpg",
        expectedUrl: "/api/media/Events%20%26%20Parties/New%20Year%27s%20Eve%202023.jpg"
    },
    {
        name: "Path with parentheses",
        directory: "Vacation (2023)",
        filename: "Beach Day #1.jpg",
        expectedBlobPath: "Vacation (2023)/Beach Day #1.jpg",
        expectedUrl: "/api/media/Vacation%20(2023)/Beach%20Day%20%231.jpg"
    }
];

function testUrlEncoding(testCase) {
    const { directory, filename, expectedBlobPath, expectedUrl } = testCase;
    
    // Simulate the API logic
    let blobPath;
    if (directory && filename.startsWith(directory)) {
        blobPath = filename;
    } else if (directory) {
        blobPath = `${directory}/${filename}`;
    } else {
        blobPath = filename;
    }
    
    // Normalize slashes
    blobPath = blobPath.replace(/\\/g, '/');
    
    // Encode each path segment separately
    const encodedPath = blobPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const url = `/api/media/${encodedPath}`;
    
    // Test blob path construction
    const blobPathMatch = blobPath === expectedBlobPath;
    console.log(`\n${testCase.name}`);
    console.log(`  Blob Path: ${blobPath}`);
    console.log(`  Expected:  ${expectedBlobPath}`);
    console.log(`  Match: ${blobPathMatch ? '✓' : '✗'}`);
    
    // Test URL encoding
    const urlMatch = url === expectedUrl;
    console.log(`  URL:       ${url}`);
    console.log(`  Expected:  ${expectedUrl}`);
    console.log(`  Match: ${urlMatch ? '✓' : '✗'}`);
    
    // Test decoding (what the API will receive)
    const decodedPath = decodeURIComponent(encodedPath);
    const decodesCorrectly = decodedPath === blobPath;
    console.log(`  Decoded:   ${decodedPath}`);
    console.log(`  Decodes correctly: ${decodesCorrectly ? '✓' : '✗'}`);
    
    return blobPathMatch && urlMatch && decodesCorrectly;
}

console.log('=== URL Encoding Test ===\n');

let allPassed = true;
for (const testCase of testCases) {
    const passed = testUrlEncoding(testCase);
    if (!passed) allPassed = false;
}

console.log('\n' + '='.repeat(50));
if (allPassed) {
    console.log('✓ All tests passed!');
} else {
    console.log('✗ Some tests failed');
    process.exit(1);
}
