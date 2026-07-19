import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// ==========================================================================
// [PRE-CHECK & IMPACT ANALYSIS GUARDRAILS]
// สคริปต์นี้เป็นคำสั่งระดับสูงสุด (Destructive Operation) บน Production 
// ห้ามประมวลผลลบจริงจนกว่าจะผ่านการตรวจสอบสิทธิ์และการรันในโหมด Dry-run 
// ==========================================================================

// โหลดตัวแปรสภาพแวดล้อมจากไฟล์คอนฟิกในเครื่อง
const envPaths = ['.env.aws.local', '.env.local', '.env'];
let envLoaded = false;
for (const envFile of envPaths) {
  const fullPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath });
    console.log(`[PRE-CHECK] Loaded environment variables from: ${envFile}`);
    envLoaded = true;
    break;
  }
}

const MONGO_URI = process.env.MONGO_URI_DIRECT || process.env.MONGO_URI;
const TARGET_PROTECTED_EMAIL = 'zudogu.official@gmail.com';
const IS_EXECUTE_MODE = process.argv.includes('--execute');

if (!MONGO_URI) {
  console.error('❌ [CRITICAL ERROR] ไม่พบ MONGO_URI หรือ MONGO_URI_DIRECT ใน environment files กรุณาตรวจสอบสิทธิ์การเข้าถึง');
  process.exit(1);
}

async function runPurgePipeline() {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await client.connect();
    const db = client.db(); // ดึง Database หลักจาก Connection String

    console.log('🔍 [ANALYSIS] ตรวจสอบโครงสร้างและสแกนหาข้อมูลค้างในระบบ...');

    // 1. ค้นหาข้อมูล User ทั้งหมดยกเว้นบัญชี Official ตัวจริง
    const usersCollection = db.collection('users');
    const allUsers = await usersCollection.find({}).toArray();
    
    const officialUser = allUsers.find(u => u.email?.toLowerCase() === TARGET_PROTECTED_EMAIL.toLowerCase());
    const usersToPurge = allUsers.filter(u => u.email?.toLowerCase() !== TARGET_PROTECTED_EMAIL.toLowerCase());

    if (!officialUser) {
      console.warn(`⚠️ [WARNING] ไม่พบบัญชีหลัก ${TARGET_PROTECTED_EMAIL} ในฐานข้อมูลปัจจุบัน!`);
    } else {
      console.log(`🛡️ [PROTECTED] บัญชีหลักปลอดภัย: ${officialUser.email} (ID: ${officialUser._notDelete || officialUser._id})`);
    }

    if (usersToPurge.length === 0) {
      console.log('✨ [CLEAN] ไม่พบ Account หรือข้อมูลค้างใดๆ ที่ต้องลบออกจากระบบ สภาพแวดล้อมสะอาด 100%');
      await client.close();
      return;
    }

    // ดึงไอดีเพื่อทำ Cascade Delete ไปยัง Collection อื่นๆ
    const userIdsToPurge = usersToPurge.map(u => u._id);
    const userStrIdsToPurge = usersToPurge.map(u => u._id.toString());

    // สแกนหาข้อมูลที่เชื่อมโยงในคอลเลกชันอื่นๆ
    const tenantsCollection = db.collection('tenants');
    const partnersCollection = db.collection('partners');
    const sessionsCollection = db.collection('sessions');
    const accountsCollection = db.collection('accounts'); // NextAuth Link accounts

    // ค้นหา Tenants และ Partners ที่ติดสัญญากับ User เหล่านี้ หรือตกค้างอยู่
    // (รองรับทั้งการเก็บแบบ ObjectId และ String ID เพื่อความแม่นยำสูงสุด)
    const tenantsToPurge = await tenantsCollection.find({
      $or: [
        { ownerId: { $in: userIdsToPurge } },
        { ownerId: { $in: userStrIdsToPurge } },
        { ownerEmail: { $in: usersToPurge.map(u => u.email) } }
      ]
    }).toArray();

    const partnersToPurge = await partnersCollection.find({
      $or: [
        { userId: { $in: userIdsToPurge } },
        { userId: { $in: userStrIdsToPurge } },
        { email: { $in: usersToPurge.map(u => u.email) } }
      ]
    }).toArray();

    // ==========================================
    // รายงานผลกระทบ (IMPACT ANALYSIS SHOWCASE)
    // ==========================================
    console.log('\n==================================================');
    console.log(IS_EXECUTE_MODE ? '⚠️ [RUNNING] กำลังทำรายการลบข้อมูลแบบถาวร...' : '🔍 [DRY-RUN MODE] รายงานผลกระทบก่อนทำงานจริง');
    console.log('==================================================');
    console.log(`• บัญชีผู้ใช้ที่จะถูกลบ: ${usersToPurge.length} รายการ`);
    usersToPurge.forEach(u => console.log(`   - User: ${u.email} (ID: ${u._id})`));
    
    console.log(`• บัญชีร้านค้า (Tenant) ที่จะถูกลบ: ${tenantsToPurge.length} รายการ`);
    tenantsToPurge.forEach(t => console.log(`   - Tenant: ${t.name || t.slug} (Owner Email: ${t.ownerEmail || 'N/A'})`));

    console.log(`• บัญชีผู้ร่วมค้า (Partner) ที่จะถูกลบ: ${partnersToPurge.length} รายการ`);
    partnersToPurge.forEach(p => console.log(`   - Partner: ${p.name || p.email}`));

    if (!IS_EXECUTE_MODE) {
      console.log('\n🛑 สคริปต์หยุดทำงานตามระเบียบความปลอดภัย (ยังไม่มีการลบข้อมูลจริง)');
      console.log('👉 หากตรวจสอบแล้วมั่นใจว่าข้อมูลด้านบนถูกต้อง กรุณารันคำสั่งอีกครั้งโดยพิมพ์:');
      console.log('   node scripts/purge-all-except-official.mjs --execute');
      console.log('==================================================\n');
      await client.close();
      return;
    }

    // ==========================================
    // ขั้นตอนการลบจริงแบบถาวร (DESTRUCTIVE PHASE)
    // ==========================================
    console.log('\n🔥 เริ่มปฏิบัติการกวาดล้างข้อมูลพังค้างคา...');

    // ลบจากคอลเลกชัน Users
    const userDelRes = await usersCollection.deleteMany({ _id: { $in: userIdsToPurge } });
    console.log(`🧹 Deleted Users: ${userDelRes.deletedCount} records.`);

    // ลบจากคอลเลกชัน Tenants
    if (tenantsToPurge.length > 0) {
      const tenantDelRes = await tenantsCollection.deleteMany({ _id: { $in: tenantsToPurge.map(t => t._id) } });
      console.log(`🧹 Deleted Tenants: ${tenantDelRes.deletedCount} records.`);
    }

    // ลบจากคอลเลกชัน Partners
    if (partnersToPurge.length > 0) {
      const partnerDelRes = await partnersCollection.deleteMany({ _id: { $in: partnersToPurge.map(p => p._id) } });
      console.log(`🧹 Deleted Partners: ${partnerDelRes.deletedCount} records.`);
    }

    // ลบ Token และ Session ตกค้างของ NextAuth เพื่อป้องกันอาการค้างที่หน้าจอฝั่ง Client
    const sessDelRes = await sessionsCollection.deleteMany({ userId: { $or: [{ $in: userIdsToPurge }, { $in: userStrIdsToPurge }] } });
    const accDelRes = await accountsCollection.deleteMany({ userId: { $or: [{ $in: userIdsToPurge }, { $in: userStrIdsToPurge }] } });
    console.log(`🧹 Cleared NextAuth Sessions/Accounts: ${sessDelRes.deletedCount + accDelRes.deletedCount} records.`);

    console.log('\n✨ [SUCCESS] การกวาดล้างเสร็จสิ้น! ระบบสะอาดบริสุทธิ์ เหลือไว้เพียงเซิร์ฟเวอร์หลักและบัญชีผู้ดูแลเท่านั้นครับ');

  } catch (error) {
    console.error('❌ [CRITICAL FAILURE] เกิดข้อผิดพลาดระหว่างกระบวนการ:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB Atlas.');
  }
}

runPurgePipeline();
