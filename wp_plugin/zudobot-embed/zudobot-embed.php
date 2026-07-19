<?php
/**
 * Plugin Name: Zudobot AI Chat Integration
 * Description: Ultimate 1-Click integration for Zudobot AI Chatbot without touching code. High security via OAuth handoff.
 * Version: 1.0.0
 * Author: ZUDOGU Team
 * License: GPLv2 or later
 * Text Domain: zudobot-embed
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly for core security
}

class Zudobot_Embed_Plugin {
    private $option_tenant_id = 'zudobot_tenant_id';
    private $option_sri_hash = 'zudobot_sri_hash';
    private $platform_auth_url = 'https://www.divesspace.com/oauth/wordpress';

    public function __construct() {
        // หยอดสคริปต์ที่หน้าบ้านลูกค้าผ่าน Action Hook มาตรฐาน
        add_action('wp_head', array($this, 'inject_widget_script'));
        // สร้างหน้าเมนูตั้งค่าในหลังบ้าน WordPress
        add_action('admin_menu', array($this, 'create_admin_menu'));
        // จัดการเซสชันขากลับเมื่อลูกค้าทำ OAuth สำเร็จจาก DivesSpace
        add_action('admin_init', array($this, 'handle_oauth_callback'));
    }

    /**
     * สั่งฝังสคริปต์อย่างปลอดภัยสูงสุดที่ <head> หน้าบ้านของลูกค้า
     */
    public function inject_widget_script() {
        $tenant_id = get_option($this->option_tenant_id);
        $sri_hash  = get_option($this->option_sri_hash);

        if (!empty($tenant_id)) {
            echo "\n\n";
            echo "<script \n";
            echo "  src=\"https://zudobot.zudogu.com/widget.js\" \n";
            echo "  data-tenant-id=\"" . esc_attr($tenant_id) . "\" \n";
            if (!empty($sri_hash)) {
                echo "  integrity=\"" . esc_attr($sri_hash) . "\" \n";
                echo "  crossorigin=\"anonymous\" \n";
            }
            echo "  defer>\n";
            echo "</script>\n";
        }
    }

    /**
     * สร้างหน้าเมนูสำหรับการตั้งค่าใน Dashboard Admin
     */
    public function create_admin_menu() {
        add_menu_page(
            'Zudobot Settings',
            'Zudobot Chat',
            'manage_options',
            'zudobot-settings',
            array($this, 'render_admin_page'),
            'dashicons-feedback',
            100
        );
    }

    /**
     * เรนเดอร์หน้าจอ UI ฝั่งแอดมิน (ออกแบบให้คล้าย SaaS ชั้นนำอย่าง HubSpot)
     */
    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.'));
        }

        $tenant_id = get_option($this->option_tenant_id);
        
        // สร้างระบบความปลอดภัยป้องกัน CSRF Attack
        $nonce = wp_create_nonce('zudobot_oauth_init');
        $return_url = admin_url('admin.php?page=zudobot-settings');
        $connect_url = add_query_arg(
            array(
                'site_url' => urlencode(site_url()),
                'return_url' => urlencode($return_url),
                'state' => $nonce
            ),
            $this->platform_auth_url
        );

        echo '<div class="wrap">';
        echo '<h1>' . esc_html(get_admin_page_title()) . '</h1>';
        echo '<div class="card" style="max-width: 600px; padding: 20px; margin-top: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">';
        echo '<h2>เชื่อมต่อเว็บไซต์ของคุณกับ Zudobot AI</h2>';
        echo '<p style="color: #666; font-size: 14px;">เริ่มต้นใช้งานบอทอัจฉริยะเพื่อตอบแชทลูกค้าอัตโนมัติ โดยที่คุณไม่ต้องสัมผัสโค้ดแม้แต่บรรทัดเดียว ระบบเชื่อมต่อผ่านโหมดความปลอดภัยสากล</p>';
        
        if (!empty($tenant_id)) {
            echo '<div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px; margin: 15px 0; border-radius: 4px;">';
            echo '<span style="color: #065f46; font-weight: bold;">✓ เชื่อมต่อสำเร็จแล้ว:</span> ';
            echo '<code style="background: #fff; padding: 2px 6px; border: 1px solid #d1d5db; border-radius: 4px;">Tenant ID: ' . esc_html($tenant_id) . '</code>';
            echo '</div>';
            
            // ปุ่มสำหรับปลดการเชื่อมต่ออย่างปลอดภัย
            $disconnect_url = wp_nonce_url(admin_url('admin.php?page=zudobot-settings&action=disconnect'), 'zudobot_disconnect');
            echo '<p style="margin-top: 25px;"><a href="' . esc_url($disconnect_url) . '" class="button button-link" style="color: #dc2626;">[ ปลดการเชื่อมต่อบัญชี ]</a></p>';
        } else {
            echo '<div style="margin: 30px 0;">';
            echo '<a href="' . esc_url($connect_url) . '" class="button button-primary button-large" style="background: #2563eb; border-color: #2563eb; font-weight: bold; padding: 6px 24px; height: auto; font-size: 15px; border-radius: 6px;">🔌 เชื่อมต่อบัญชี Zudobot ทันที</a>';
            echo '</div>';
        }
        
        echo '</div>';
        echo '</div>';
    }

    /**
     * ดักรับสัญญาณการ Callback จากหน้าเว็บหลักเพื่อบันทึกข้อมูลแบบปลอดภัย
     */
    public function handle_oauth_callback() {
        if (!is_admin() || !current_user_can('manage_options')) {
            return;
        }

        // กรณีที่ 1: ตรวจสอบและดักรับข้อมูล Tenant ID ขากลับจากการยืนยันสิทธิ์
        if (isset($_GET['page']) && $_GET['page'] === 'zudobot-settings' && isset($_GET['tenant_id'])) {
            // ทำความสะอาดข้อมูลเพื่อป้องกัน XSS
            $tenant_id = sanitize_text_field($_GET['tenant_id']);
            $sri_hash  = isset($_GET['sri_hash']) ? sanitize_text_field($_GET['sri_hash']) : '';

            // บันทึกลงตาราง Options ของ WordPress
            update_option($this->option_tenant_id, $tenant_id);
            update_option($this->option_sri_hash, $sri_hash);

            // เคลียร์ Query เพื่อให้หน้าเว็บสะอาดและปลอดภัย
            wp_redirect(admin_url('admin.php?page=zudobot-settings'));
            exit;
        }

        // กรณีที่ 2: ดักรับสัญญาณการตัดการเชื่อมต่อ (Disconnect)
        if (isset($_GET['page']) && $_GET['page'] === 'zudobot-settings' && isset($_GET['action']) && $_GET['action'] === 'disconnect') {
            check_admin_referer('zudobot_disconnect');
            
            delete_option($this->option_tenant_id);
            delete_option($this->option_sri_hash);
            
            wp_redirect(admin_url('admin.php?page=zudobot-settings'));
            exit;
        }
    }
}

// เริ่มการทำงานของระบบพาร์ทเนอร์ปลั๊กอิน
new Zudobot_Embed_Plugin();
