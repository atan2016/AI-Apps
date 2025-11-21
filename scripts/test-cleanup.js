/**
 * Test script to manually call the cleanup GET endpoint
 * Usage: node scripts/test-cleanup.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const SUBDIRECTORY = process.env.USE_SUBDIRECTORY === 'true' ? '/imageEnhancer' : '';

async function testCleanup() {
  const url = `${BASE_URL}${SUBDIRECTORY}/api/cleanup`;
  console.log(`🔄 Calling cleanup endpoint: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('\n✅ Response received:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.cleanupRun) {
      console.log(`\n🧹 Cleanup executed: ${data.deletedCount} images deleted`);
      if (data.errorCount > 0) {
        console.log(`⚠️  Errors: ${data.errorCount}`);
      }
    } else {
      console.log('\n📊 Storage check only (not a cron request)');
    }
    
    console.log(`\n💾 Storage usage: ${data.percentage}% (${data.imageCount} images)`);
    
  } catch (error) {
    console.error('❌ Error calling cleanup endpoint:', error.message);
    process.exit(1);
  }
}

testCleanup();

