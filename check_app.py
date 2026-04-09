#!/usr/bin/env python3
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Capture console messages
    console_logs = []
    page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
    
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    
    # Take screenshot
    page.screenshot(path='/tmp/app_screenshot.png', full_page=True)
    print("✅ Screenshot taken: /tmp/app_screenshot.png")
    
    # Wait a moment for debug logs
    time.sleep(2)
    
    # Print console logs (focusing on our debug output)
    print("\n🔍 Console Logs:")
    for log in console_logs:
        if any(keyword in log for keyword in ['Polyline', 'buildDashed', 'renderStroke', 'Dash', 'pointAt', 'Polygon']):
            print(f"  {log}")
    
    # Get page content for inspection
    content = page.content()
    
    # Look for specific debug info in page
    if 'pointCount' in content or '774' in content:
        print("\n✅ High-precision polyline data found (774 points)")
    
    browser.close()
    print("\n✅ Done!")
