// Simple script to test if specific files exist in blob storage via the API
// This will help us understand where the disconnect is

const testCases = [
    {
        name: "File from database (with backslash path)",
        url: "https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media/Devorah's%20Wedding%5CPA130132.JPG"
    },
    {
        name: "File from database (with forward slash)",  
        url: "https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media/Devorah's%20Wedding%2FPA130132.JPG"
    },
    {
        name: "File from database - PA130068 (with forward slash)",
        url: "https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media/Devorah's%20Wedding%2FPA130068.JPG"
    },
    {
        name: "Maybe under Family Pictures?",
        url: "https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media/Family%20Pictures%2FDevorah's%20Wedding%2FPA130068.JPG"
    }
];

console.log('Testing which paths work in blob storage...\n');

async function testUrl(testCase) {
    try {
        const response = await fetch(testCase.url);
        const status = response.status;
        const contentType = response.headers.get('content-type');
        
        if (status === 200) {
            console.log(`✓ SUCCESS: ${testCase.name}`);
            console.log(`  URL: ${testCase.url}`);
            console.log(`  Content-Type: ${contentType}`);
            console.log('');
            return true;
        } else if (status === 404) {
            console.log(`✗ NOT FOUND (404): ${testCase.name}`);
            const text = await response.text();
            try {
                const json = JSON.parse(text);
                console.log(`  Error: ${json.error}`);
            } catch {}
            console.log('');
            return false;
        } else {
            console.log(`✗ ERROR (${status}): ${testCase.name}`);
            console.log(`  URL: ${testCase.url}`);
            const text = await response.text();
            if (text) {
                console.log(`  Response: ${text.substring(0, 200)}`);
            }
            console.log('');
            return false;
        }
    } catch (error) {
        console.log(`✗ EXCEPTION: ${testCase.name}`);
        console.log(`  Error: ${error.message}`);
        console.log('');
        return false;
    }
}

async function runTests() {
    for (const testCase of testCases) {
        await testUrl(testCase);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between requests
    }
}

runTests();
