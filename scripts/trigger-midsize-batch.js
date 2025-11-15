// Trigger batch midsize generation via API
const fs = require('fs');
const path = require('path');

// Load settings from local.settings.json
const settingsPath = path.join(__dirname, '..', 'api', 'local.settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const values = settings.Values || {};

// Configuration
const API_BASE = process.env.API_BASE || 'https://mortonfamilyalbum.com';
const BATCH_SIZE = parseInt(process.argv[2]) || 100; // Default 100 images per batch
const MAX_BATCHES = parseInt(process.argv[3]) || 100; // Maximum number of batches to run

console.log('=== MIDSIZE BATCH GENERATION ===\n');
console.log(`API Base URL: ${API_BASE}`);
console.log(`Batch Size: ${BATCH_SIZE} images`);
console.log(`Max Batches: ${MAX_BATCHES}\n`);

let totalProcessed = 0;
let totalSucceeded = 0;
let totalFailed = 0;
let batchCount = 0;

async function triggerBatch() {
    try {
        console.log(`\nStarting batch ${batchCount + 1}...`);
        
        const response = await fetch(`${API_BASE}/api/generate-midsize/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ batchSize: BATCH_SIZE }),
            credentials: 'include'
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg;
            try {
                const errorJson = JSON.parse(errorText);
                errorMsg = errorJson.error || response.statusText;
            } catch {
                errorMsg = errorText || response.statusText;
            }
            throw new Error(`API error (${response.status}): ${errorMsg}`);
        }

        const result = await response.json();
        console.log(`✓ Batch started: ${result.message}`);
        
        // Poll for progress
        await pollProgress();
        
    } catch (err) {
        console.error(`✗ Error triggering batch: ${err.message}`);
        throw err;
    }
}

async function pollProgress() {
    let previousProcessed = 0;
    let stuckCount = 0;
    
    while (true) {
        try {
            const response = await fetch(`${API_BASE}/api/generate-midsize/progress`, {
                credentials: 'include'
            });

            const progress = await response.json();
            
            if (!progress.isRunning) {
                console.log(`\nBatch ${batchCount + 1} completed:`);
                console.log(`  Processed: ${progress.processed}`);
                console.log(`  Succeeded: ${progress.succeeded}`);
                console.log(`  Failed: ${progress.failed}`);
                console.log(`  Skipped: ${progress.skipped}`);
                
                totalProcessed += progress.processed;
                totalSucceeded += progress.succeeded;
                totalFailed += progress.failed;
                batchCount++;
                
                return progress;
            }

            // Check if progress is stuck
            if (progress.processed === previousProcessed) {
                stuckCount++;
                if (stuckCount > 60) { // 60 * 2 seconds = 2 minutes stuck
                    console.warn('\n⚠ Progress appears stuck, continuing anyway...');
                    return progress;
                }
            } else {
                stuckCount = 0;
            }
            previousProcessed = progress.processed;

            // Show progress
            const percent = progress.total > 0 ? ((progress.processed / progress.total) * 100).toFixed(1) : 0;
            process.stdout.write(`\r  Progress: ${progress.processed}/${progress.total} (${percent}%) - Succeeded: ${progress.succeeded}, Failed: ${progress.failed}, Skipped: ${progress.skipped}  `);
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
            
        } catch (err) {
            console.error(`\nError polling progress: ${err.message}`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

async function checkRemaining() {
    try {
        const response = await fetch(`${API_BASE}/api/generate-midsize`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const status = await response.json();
        return status.filesNeedingMidsize || 0;
    } catch (err) {
        console.error(`Error checking remaining: ${err.message}`);
        return -1;
    }
}

async function main() {
    try {
        // Check initial count
        const initialRemaining = await checkRemaining();
        if (initialRemaining === 0) {
            console.log('✓ All images already have midsize versions!');
            return;
        }
        
        console.log(`Images needing midsize: ${initialRemaining}\n`);
        console.log('Starting batch processing...');
        console.log('Press Ctrl+C to stop at any time.\n');

        // Process batches until done or max reached
        while (batchCount < MAX_BATCHES) {
            await triggerBatch();
            
            // Check if there are more to process
            const remaining = await checkRemaining();
            console.log(`\nRemaining images: ${remaining}`);
            
            if (remaining === 0) {
                console.log('\n✓ All images processed!');
                break;
            }
            
            if (batchCount >= MAX_BATCHES) {
                console.log(`\n⚠ Maximum batches (${MAX_BATCHES}) reached.`);
                console.log('Run the script again to continue processing.');
                break;
            }
            
            // Wait a bit between batches
            console.log('Waiting 5 seconds before next batch...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log('\n=== SUMMARY ===');
        console.log(`Total Batches: ${batchCount}`);
        console.log(`Total Processed: ${totalProcessed}`);
        console.log(`Total Succeeded: ${totalSucceeded}`);
        console.log(`Total Failed: ${totalFailed}`);
        
    } catch (err) {
        console.error('\n✗ Fatal error:', err.message);
        process.exit(1);
    }
}

main();
