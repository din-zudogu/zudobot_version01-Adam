const fs = require('fs');
const path = require('path');

// โฟลเดอร์ที่ต้องการสแกน (ถ้าโฟลเดอร์หลักชื่ออื่น ให้เปลี่ยนตรงนี้นะครับ)
const DIRECTORY_TO_SCAN = './apps/web';

// โฟลเดอร์ที่ไม่ต้องเข้าไปหา (เพื่อความรวดเร็ว)
const IGNORE_DIRS = ['node_modules', '.next', 'dist', 'build', '.git', 'public'];

// คำค้นหาที่มักจะเป็น "ตัวดัก" ไม่ให้ใช้ฟรี
const KEYWORDS = [
    'subscription',
    'stripe',
    'isPro',
    'isActive',
    'payment',
    'checkout',
    'redirect(',
    'NextResponse.redirect'
];

function scanDirectory(dir) {
    let results = [];

    if (!fs.existsSync(dir)) {
        return [`❌ หาโฟลเดอร์ ${dir} ไม่เจอ กรุณาตรวจสอบ path`];
    }

    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (!IGNORE_DIRS.includes(file)) {
                results = results.concat(scanDirectory(fullPath));
            }
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                KEYWORDS.forEach(keyword => {
                    // ถ้าบรรทัดนั้นมี Keyword และไม่ได้ถูกคอมเมนต์ไว้ (//)
                    if (line.toLowerCase().includes(keyword.toLowerCase()) && !line.trim().startsWith('//')) {
                        results.push(`🚨 พบ "${keyword}" ที่ไฟล์: ${fullPath} (บรรทัด ${index + 1}) \n   👉 โค้ด: ${line.trim()}\n`);
                    }
                });
            });
        }
    }
    return results;
}

console.log('🔍 เจมกำลังสแกนหาโค้ดที่อาจจะบล็อกการใช้งานฟรี...');
console.log('--------------------------------------------------');

const findings = scanDirectory(DIRECTORY_TO_SCAN);

if (findings.length > 0) {
    console.log(`เจอจุดที่น่าสงสัยทั้งหมด ${findings.length} จุด (ลองเช็กไฟล์เหล่านี้ดูนะครับ):\n`);
    findings.forEach(f => console.log(f));
} else {
    console.log('✅ ไม่พบ Keyword ที่เกี่ยวกับการบังคับจ่ายเงินในโค้ดครับ!');
}