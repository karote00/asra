#!/usr/bin/env python3

from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Capture all console logs
    console_logs = []
    def handle_console(msg):
        console_logs.append({
            'type': msg.type,
            'text': msg.text,
            'location': msg.location
        })
        print(f"[{msg.type.upper()}] {msg.text}")
    
    page.on("console", handle_console)
    
    # Navigate to the app
    print("連接到 localhost:3000...")
    page.goto('http://localhost:3000', wait_until='networkidle')
    print("✅ 頁面已加載")
    
    # Wait a bit for any additional logs
    page.wait_for_timeout(2000)
    
    # Take screenshot
    page.screenshot(path='/tmp/debug_stroke.png', full_page=True)
    print("✅ 屏幕截圖已保存: /tmp/debug_stroke.png")
    
    # Print all logs
    print("\n" + "="*60)
    print("浏览器控制台日誌:")
    print("="*60)
    for log in console_logs:
        print(f"[{log['type']}] {log['text']}")
    
    # Save logs to file
    with open('/tmp/debug_logs.json', 'w') as f:
        json.dump(console_logs, f, indent=2)
    print("\n✅ 日誌已保存: /tmp/debug_logs.json")
    
    browser.close()
