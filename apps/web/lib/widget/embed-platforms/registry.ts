import { SupportedPlatform, PlatformInstruction } from './types';

export const platformRegistry: Record<SupportedPlatform, PlatformInstruction> = {
  'WordPress': {
    platform: 'WordPress',
    displayName: 'WordPress',
    installationType: 'Manual',
    steps: [
      "1. เข้าสู่ระบบจัดการหลังบ้าน (WP-Admin)",
      "2. ไปที่เมนู Appearance > Theme File Editor",
      "3. ค้นหาไฟล์ header.php หรือ footer.php",
      "4. วางสคริปต์ Zudobot ไว้ก่อนแท็กปิด </body>",
      "5. กด Update File เพื่อบันทึก"
    ]
  },
  'Shopify': {
    platform: 'Shopify',
    displayName: 'Shopify',
    installationType: 'Manual',
    steps: [
      "1. เข้าสู่ระบบ Shopify Admin",
      "2. ไปที่ Online Store > Themes",
      "3. คลิกปุ่ม '...' (Actions) ข้างธีมปัจจุบัน แล้วเลือก 'Edit code'",
      "4. เปิดไฟล์ theme.liquid",
      "5. วางสคริปต์ Zudobot ไว้ก่อนแท็กปิด </body>",
      "6. กด Save เพื่อบันทึก"
    ]
  },
  'Wix': {
    platform: 'Wix',
    displayName: 'Wix',
    installationType: 'Manual',
    steps: [
      "1. ไปที่ Settings ในหน้า Dashboard ของ Wix",
      "2. เลื่อนลงมาที่ Advanced เลือก Custom Code",
      "3. คลิก + Add Custom Code",
      "4. วางสคริปต์ Zudobot และเลือก Place Code in: Body - end",
      "5. กด Apply"
    ]
  },
  'Squarespace': {
    platform: 'Squarespace',
    displayName: 'Squarespace',
    installationType: 'Manual',
    steps: [
      "1. ไปที่ Settings > Advanced > Code Injection",
      "2. เลื่อนไปที่ส่วน Footer",
      "3. วางสคริปต์ Zudobot ลงในกล่อง",
      "4. กด Save"
    ]
  },
  'Webflow': {
    platform: 'Webflow',
    displayName: 'Webflow',
    installationType: 'Manual',
    steps: [
      "1. เปิดหน้า Project Settings",
      "2. ไปที่แท็บ Custom Code",
      "3. เลื่อนไปที่หัวข้อ Footer Code",
      "4. วางสคริปต์ Zudobot ลงในกล่อง",
      "5. กด Save Changes และ Publish เว็บไซต์"
    ]
  },
  'Custom': {
    platform: 'Custom',
    displayName: 'Custom HTML Website',
    installationType: 'Manual',
    steps: [
      "1. เปิดไฟล์ HTML หลักของเว็บไซต์คุณ (เช่น index.html)",
      "2. วางสคริปต์ Zudobot ไว้ก่อนแท็กปิด </body>",
      "3. บันทึกและอัปโหลดไฟล์ขึ้นเซิร์ฟเวอร์"
    ]
  },
  'Unknown': {
    platform: 'Unknown',
    displayName: 'Website',
    installationType: 'Manual',
    steps: [
      "นำโค้ดสคริปต์ Zudobot ไปวางไว้ก่อนแท็กปิด </body> ในซอร์สโค้ดหน้าเว็บไซต์ของคุณ"
    ]
  }
};
